package main

import (
	"bufio"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Skill represents a single capability skill.
type Skill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Scripts     []string `json:"scripts"`
	References  []string `json:"references"`
	Category    string   `json:"category"`
	Agent       string   `json:"agent,omitempty"`
	AgentDir    string   `json:"agentDir,omitempty"`
}
// agentSkillMap maps skill IDs to Harbinger agents.
var agentSkillMap = map[string]struct{ Agent, AgentDir string }{
	"recon":              {Agent: "PATHFINDER", AgentDir: "recon-scout"},
	"web":                {Agent: "BREACH", AgentDir: "web-hacker"},
	"cloud":              {Agent: "PHANTOM", AgentDir: "cloud-infiltrator"},
	"osint":              {Agent: "SPECTER", AgentDir: "osint-detective"},
	"reporting":          {Agent: "SCRIBE", AgentDir: "report-writer"},
	"binary-re":          {Agent: "CIPHER", AgentDir: "binary-reverser"},
	"network":            {Agent: "PHANTOM", AgentDir: "cloud-infiltrator"},
	"mobile":             {Agent: "BREACH", AgentDir: "web-hacker"},
	"fuzzing":            {Agent: "CIPHER", AgentDir: "binary-reverser"},
	"crypto":             {Agent: "CIPHER", AgentDir: "binary-reverser"},
	"social-engineering": {Agent: "SPECTER", AgentDir: "osint-detective"},
	"maintainer":         {Agent: "MAINTAINER", AgentDir: "maintainer"},
	"feature-deploy":     {Agent: "SAM", AgentDir: "coding-assistant"},
}
// skillsDir returns the skills directory. Checks SKILLS_DIR env, /app/skills, then binary-relative path.
func skillsDir() string {
	if v := os.Getenv("SKILLS_DIR"); v != "" {
		return v
	}
	if _, err := os.Stat("/app/skills"); err == nil {
		return "/app/skills"
	}
	exe, err := os.Executable()
	if err == nil {
		rel := filepath.Join(filepath.Dir(exe), "..", "..", "..", "skills")
		if abs, err := filepath.Abs(rel); err == nil {
			if _, err := os.Stat(abs); err == nil {
				return abs
			}
		}
	}
	return ""
}
func parseSkillMD(path string) (name, description string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return "", "", err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return "", "", nil
	}
	if strings.TrimSpace(scanner.Text()) != "---" {
		return "", "", nil
	}

	inDescription := false
	var descLines []string

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if trimmed == "---" {
			break
		}

		// New unindented key resets description mode.
		if len(line) > 0 && line[0] != ' ' && line[0] != '	' && strings.Contains(line, ":") {
			inDescription = false
		}

		if strings.HasPrefix(trimmed, "name:") {
			name = strings.TrimSpace(strings.TrimPrefix(trimmed, "name:"))
			continue
		}

		if strings.HasPrefix(trimmed, "description:") {
			rest := strings.TrimSpace(strings.TrimPrefix(trimmed, "description:"))
			rest = strings.TrimLeft(rest, ">|-")
			rest = strings.TrimSpace(rest)
			if rest != "" {
				descLines = append(descLines, rest)
			}
			inDescription = true
			continue
		}

		if inDescription {
			if len(line) > 0 && (line[0] == ' ' || line[0] == '	') {
				descLines = append(descLines, strings.TrimSpace(line))
			} else {
				inDescription = false
			}
		}
	}

	description = strings.Join(descLines, " ")
	return name, description, nil
}

// listSkillFiles returns sorted basenames of files in dirPath.
func listSkillFiles(dirPath string) []string {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return []string{}
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

// loadSkills reads all subdirectories of root, parses SKILL.md files, returns sorted slice.
func loadSkills(root string) []Skill {
	entries, err := os.ReadDir(root)
	if err != nil {
		return []Skill{}
	}

	skills := make([]Skill, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		id := entry.Name()
		skillPath := filepath.Join(root, id)
		mdPath := filepath.Join(skillPath, "SKILL.md")

		name, desc, _ := parseSkillMD(mdPath)
		if name == "" {
			name = id
		}

		skill := Skill{
			ID:          id,
			Name:        name,
			Description: desc,
			Scripts:     listSkillFiles(filepath.Join(skillPath, "scripts")),
			References:  listSkillFiles(filepath.Join(skillPath, "references")),
			Category:    id,
		}

		if mapping, ok := agentSkillMap[id]; ok {
			skill.Agent = mapping.Agent
			skill.AgentDir = mapping.AgentDir
		}

		skills = append(skills, skill)
	}

	sort.Slice(skills, func(i, j int) bool {
		return skills[i].ID < skills[j].ID
	})
	return skills
}

func handleListSkills(w http.ResponseWriter, r *http.Request) {
	root := skillsDir()
	if root == "" {
		writeJSON(w, http.StatusOK, []Skill{})
		return
	}
	writeJSON(w, http.StatusOK, loadSkills(root))
}

func handleGetSkill(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	root := skillsDir()
	if root == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "skills directory not configured"})
		return
	}

	for _, skill := range loadSkills(root) {
		if skill.ID == id {
			writeJSON(w, http.StatusOK, skill)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "skill not found"})
}
