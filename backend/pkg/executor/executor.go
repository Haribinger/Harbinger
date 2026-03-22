// Package executor provides sandboxed Docker container execution for Harbinger agents.
// It communicates with the Docker Engine API v1.41 via raw HTTP over unix socket or TCP,
// without depending on the Docker Go SDK.
package executor

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ExecutorConfig controls how the executor connects to Docker and sets defaults.
type ExecutorConfig struct {
	// DockerHost is a TCP address like "tcp://docker-proxy:2375". If empty, unix socket is used.
	DockerHost string
	// DockerSocket is the path to the Docker unix socket. Defaults to /var/run/docker.sock.
	DockerSocket string
	// Network is the Docker network to attach containers to. Empty means default bridge.
	Network string
	// WorkDir is the default working directory inside containers.
	WorkDir string
	// DefaultImage is the fallback image when SpawnRequest.Image is empty.
	DefaultImage string
}

// Container represents a tracked Docker container.
type Container struct {
	ContainerID string
	Name        string
	Image       string
	Status      string
	Ports       []int
}

// SpawnRequest describes a container to create and start.
type SpawnRequest struct {
	Name    string
	Image   string
	Env     []string
	Volumes map[string]string
}

// ExecRequest describes a command to run inside an existing container.
type ExecRequest struct {
	Command []string
	WorkDir string
	Env     []string
}

// ExecResult holds the output of an executed command.
type ExecResult struct {
	ExitCode int
	Stdout   string
	Stderr   string
}

// Executor manages Docker containers for sandboxed command execution.
type Executor struct {
	config     ExecutorConfig
	httpClient *http.Client
	baseURL    string
	mu         sync.RWMutex
	containers map[string]*Container
}

// NewExecutor builds an HTTP client (unix socket or TCP), pings Docker, and returns
// an error if the daemon is unreachable.
func NewExecutor(cfg ExecutorConfig) (*Executor, error) {
	if cfg.DockerSocket == "" {
		cfg.DockerSocket = "/var/run/docker.sock"
	}
	if cfg.DefaultImage == "" {
		cfg.DefaultImage = "alpine:latest"
	}

	e := &Executor{
		config:     cfg,
		containers: make(map[string]*Container),
	}

	if cfg.DockerHost != "" {
		// TCP mode: convert tcp://host:port to http://host:port
		addr := strings.Replace(cfg.DockerHost, "tcp://", "http://", 1)
		e.baseURL = addr
		e.httpClient = &http.Client{Timeout: 30 * time.Second}
	} else {
		// Unix socket mode
		e.baseURL = "http://localhost"
		e.httpClient = &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
					return net.Dial("unix", cfg.DockerSocket)
				},
			},
		}
	}

	// Ping Docker to verify connectivity
	resp, err := e.httpClient.Get(e.baseURL + "/v1.41/_ping")
	if err != nil {
		return nil, fmt.Errorf("docker unreachable: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("docker ping returned status %d", resp.StatusCode)
	}

	return e, nil
}

// Spawn pulls the image (best-effort), creates a container with a keep-alive command,
// starts it, and tracks it in the executor's map.
func (e *Executor) Spawn(ctx context.Context, req SpawnRequest) (*Container, error) {
	image := req.Image
	if image == "" {
		image = e.config.DefaultImage
	}

	// Best-effort image pull — ignore errors (image may already exist locally)
	e.pullImage(ctx, image)

	name := fmt.Sprintf("harbinger-%s-%d", req.Name, time.Now().UnixMilli())

	// Build container create payload
	createBody := map[string]any{
		"Image": image,
		"Cmd":   []string{"sleep", "3600"},
		"Tty":   false,
	}
	if len(req.Env) > 0 {
		createBody["Env"] = req.Env
	}
	if e.config.WorkDir != "" {
		createBody["WorkingDir"] = e.config.WorkDir
	}

	hostConfig := map[string]any{}
	if len(req.Volumes) > 0 {
		binds := make([]string, 0, len(req.Volumes))
		for hostPath, containerPath := range req.Volumes {
			binds = append(binds, hostPath+":"+containerPath)
		}
		hostConfig["Binds"] = binds
	}
	if e.config.Network != "" {
		hostConfig["NetworkMode"] = e.config.Network
	}
	createBody["HostConfig"] = hostConfig

	body, err := json.Marshal(createBody)
	if err != nil {
		return nil, fmt.Errorf("marshal create body: %w", err)
	}

	// Create container
	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		e.baseURL+"/v1.41/containers/create?name="+name, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("create container: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("create container returned %d: %s", resp.StatusCode, string(respBody))
	}

	var createResp struct {
		Id string `json:"Id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&createResp); err != nil {
		return nil, fmt.Errorf("decode create response: %w", err)
	}

	// Start container
	startReq, err := http.NewRequestWithContext(ctx, "POST",
		e.baseURL+"/v1.41/containers/"+createResp.Id+"/start", nil)
	if err != nil {
		return nil, err
	}
	startResp, err := e.httpClient.Do(startReq)
	if err != nil {
		return nil, fmt.Errorf("start container: %w", err)
	}
	startResp.Body.Close()
	if startResp.StatusCode != http.StatusNoContent && startResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("start container returned %d", startResp.StatusCode)
	}

	c := &Container{
		ContainerID: createResp.Id,
		Name:        name,
		Image:       image,
		Status:      "running",
	}

	e.mu.Lock()
	e.containers[createResp.Id] = c
	e.mu.Unlock()

	return c, nil
}

// Exec creates an exec instance, starts it attached, reads multiplexed output, and
// inspects for the exit code.
func (e *Executor) Exec(ctx context.Context, containerID string, req ExecRequest) (*ExecResult, error) {
	// Create exec
	execCreate := map[string]any{
		"AttachStdout": true,
		"AttachStderr": true,
		"Cmd":          req.Command,
	}
	if req.WorkDir != "" {
		execCreate["WorkingDir"] = req.WorkDir
	}
	if len(req.Env) > 0 {
		execCreate["Env"] = req.Env
	}

	body, err := json.Marshal(execCreate)
	if err != nil {
		return nil, fmt.Errorf("marshal exec create: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		e.baseURL+"/v1.41/containers/"+containerID+"/exec", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("create exec: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("create exec returned %d: %s", resp.StatusCode, string(respBody))
	}

	var execResp struct {
		Id string `json:"Id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&execResp); err != nil {
		return nil, fmt.Errorf("decode exec response: %w", err)
	}

	// Start exec (attached — returns multiplexed stream)
	startBody, _ := json.Marshal(map[string]any{"Detach": false, "Tty": false})
	startReq, err := http.NewRequestWithContext(ctx, "POST",
		e.baseURL+"/v1.41/exec/"+execResp.Id+"/start", bytes.NewReader(startBody))
	if err != nil {
		return nil, err
	}
	startReq.Header.Set("Content-Type", "application/json")

	startResp, err := e.httpClient.Do(startReq)
	if err != nil {
		return nil, fmt.Errorf("start exec: %w", err)
	}
	defer startResp.Body.Close()

	if startResp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(startResp.Body)
		return nil, fmt.Errorf("start exec returned %d: %s", startResp.StatusCode, string(respBody))
	}

	stdout, stderr := demuxDockerStream(startResp.Body)

	// Inspect exec for exit code
	inspectReq, err := http.NewRequestWithContext(ctx, "GET",
		e.baseURL+"/v1.41/exec/"+execResp.Id+"/json", nil)
	if err != nil {
		return nil, err
	}

	inspectResp, err := e.httpClient.Do(inspectReq)
	if err != nil {
		return nil, fmt.Errorf("inspect exec: %w", err)
	}
	defer inspectResp.Body.Close()

	var inspectResult struct {
		ExitCode int `json:"ExitCode"`
	}
	if err := json.NewDecoder(inspectResp.Body).Decode(&inspectResult); err != nil {
		return nil, fmt.Errorf("decode inspect: %w", err)
	}

	return &ExecResult{
		ExitCode: inspectResult.ExitCode,
		Stdout:   stdout,
		Stderr:   stderr,
	}, nil
}

// Stop sends a stop signal to the container.
func (e *Executor) Stop(ctx context.Context, containerID string) error {
	req, err := http.NewRequestWithContext(ctx, "POST",
		e.baseURL+"/v1.41/containers/"+containerID+"/stop", nil)
	if err != nil {
		return err
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("stop container: %w", err)
	}
	resp.Body.Close()

	// 204 = stopped, 304 = already stopped — both are fine
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotModified {
		return fmt.Errorf("stop container returned %d", resp.StatusCode)
	}

	e.mu.Lock()
	if c, ok := e.containers[containerID]; ok {
		c.Status = "stopped"
	}
	e.mu.Unlock()

	return nil
}

// Remove stops and force-removes a container, including its anonymous volumes.
func (e *Executor) Remove(ctx context.Context, containerID string) error {
	// Stop first (ignore errors — container may already be stopped)
	_ = e.Stop(ctx, containerID)

	req, err := http.NewRequestWithContext(ctx, "DELETE",
		e.baseURL+"/v1.41/containers/"+containerID+"?force=true&v=true", nil)
	if err != nil {
		return err
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("remove container: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("remove container returned %d", resp.StatusCode)
	}

	e.mu.Lock()
	delete(e.containers, containerID)
	e.mu.Unlock()

	return nil
}

// Cleanup removes all tracked containers concurrently.
func (e *Executor) Cleanup(ctx context.Context) {
	e.mu.RLock()
	ids := make([]string, 0, len(e.containers))
	for id := range e.containers {
		ids = append(ids, id)
	}
	e.mu.RUnlock()

	var wg sync.WaitGroup
	for _, id := range ids {
		wg.Add(1)
		go func(cid string) {
			defer wg.Done()
			_ = e.Remove(ctx, cid)
		}(id)
	}
	wg.Wait()
}

// pullImage attempts to pull a Docker image. Errors are ignored — the image may
// already exist locally or the pull may timeout without consequence.
func (e *Executor) pullImage(ctx context.Context, image string) {
	req, err := http.NewRequestWithContext(ctx, "POST",
		e.baseURL+"/v1.41/images/create?fromImage="+image, nil)
	if err != nil {
		return
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return
	}
	// Drain the response body (pull streams progress JSON) so the connection can be reused
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
}

// demuxDockerStream reads Docker's multiplexed stream format.
// Each frame has an 8-byte header: [stream_type(1) padding(3) size(4)] followed by payload.
// stream_type 1 = stdout, stream_type 2 = stderr.
func demuxDockerStream(r io.Reader) (stdout, stderr string) {
	var stdoutBuf, stderrBuf bytes.Buffer
	header := make([]byte, 8)

	for {
		_, err := io.ReadFull(r, header)
		if err != nil {
			break
		}

		streamType := header[0]
		size := binary.BigEndian.Uint32(header[4:8])
		if size == 0 {
			continue
		}

		payload := make([]byte, size)
		_, err = io.ReadFull(r, payload)
		if err != nil {
			break
		}

		switch streamType {
		case 1:
			stdoutBuf.Write(payload)
		case 2:
			stderrBuf.Write(payload)
		}
	}

	return stdoutBuf.String(), stderrBuf.String()
}
