package config

import (
	"fmt"
	"os"
	"time"
	
	"github.com/spf13/viper"
)

type Config struct {
	App               AppConfig
	Database          DatabaseConfig
	Redis             RedisConfig
	Neo4j             Neo4jConfig
	MCP               MCPConfig
	Frontend          FrontendConfig
	Security          SecurityConfig
	Logging           LoggingConfig
	ExternalTools     ExternalToolsConfig
	AIServices        AIServicesConfig
	Webhooks          WebhookConfig
	Storage           StorageConfig
	BugBounty         BugBountyConfig
	Monitoring        MonitoringConfig
}

type AppConfig struct {
	Name    string
	Version string
	Env     string
	Port    int
	Host    string
}

type DatabaseConfig struct {
	Host           string
	Port           int
	Name           string
	User           string
	Password       string
	SSL            bool
	MaxConnections int
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
	PoolSize int
}

type Neo4jConfig struct {
	Host     string
	Port     int
	User     string
	Password string
}

type MCPConfig struct {
	Enabled     bool
	PluginsDir  string
	HexridgeURL string
	PentagiURL  string
	UIURL       string
}

type FrontendConfig struct {
	URL       string
	BuildDir  string
	APIBaseURL string
	WSURL     string
}

type SecurityConfig struct {
	JWTSecret           string
	JWTExpiresIn        time.Duration
	CORSOrigin          string
	RateLimitRequests   int
	RateLimitWindow     time.Duration
	EncryptionKey       string
}

type LoggingConfig struct {
	Level       string
	Format      string
	File        string
	MaxSize     string
	MaxBackups  int
}

type ExternalToolsConfig struct {
	Nikto      string
	Dirsearch  string
	Nuclei     string
	Burp       string
	OWASPZAP   string
	SQLMap     string
	Metasploit string
}

type AIServicesConfig struct {
	OpenAIAPIKey     string
	OpenAIModel      string
	AnthropicAPIKey  string
	AnthropicModel   string
	HuggingfaceAPIKey string
	GoogleAIAPIKey   string
}

type WebhookConfig struct {
	SlackWebhookURL  string
	DiscordWebhookURL string
	TeamsWebhookURL  string
	WebhookSecret    string
}

type StorageConfig struct {
	AWSRegion   string
	S3Bucket    string
	S3AccessKey string
	S3SecretKey string
	CDNURL      string
}

type BugBountyConfig struct {
	Hackerone struct {
		APIURL    string
		APIKey    string
		Username  string
	}
	Bugcrowd struct {
		APIURL    string
		APIKey    string
		Username  string
	}
	Intigriti struct {
		APIURL    string
		APIKey    string
		Username  string
	}
}

type MonitoringConfig struct {
	MetricsEnabled       bool
	MetricsPort          int
	HealthCheckInterval  time.Duration
	PrometheusEndpoint   string
}

func Load() (*Config, error) {
	viper.SetConfigName("runtime")
	viper.SetConfigType("env")
	viper.AddConfigPath("./config")
	viper.AddConfigPath(".")
	
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}
	
	setDefaults()
	viper.AutomaticEnv()
	
	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}
	
	var err error
	if config.Security.JWTExpiresIn, err = time.ParseDuration(viper.GetString("security.jwt_expires_in")); err != nil {
		config.Security.JWTExpiresIn = 24 * time.Hour
	}
	
	if config.Security.RateLimitWindow, err = time.ParseDuration(viper.GetString("security.rate_limit_window")); err != nil {
		config.Security.RateLimitWindow = 15 * time.Minute
	}
	
	if config.Monitoring.HealthCheckInterval, err = time.ParseDuration(viper.GetString("monitoring.health_check_interval")); err != nil {
		config.Monitoring.HealthCheckInterval = 30 * time.Second
	}
	
	return &config, nil
}

func setDefaults() {
	viper.SetDefault("app.name", "Harbinger")
	viper.SetDefault("app.version", "1.0.0")
	viper.SetDefault("app.env", "development")
	viper.SetDefault("app.port", 8080)
	viper.SetDefault("app.host", "0.0.0.0")
	
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.name", "harbinger")
	viper.SetDefault("database.user", "harbinger")
	viper.SetDefault("database.password", "")
	viper.SetDefault("database.ssl", false)
	viper.SetDefault("database.max_connections", 20)
	
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)
	
	viper.SetDefault("neo4j.host", "localhost")
	viper.SetDefault("neo4j.port", 7687)
	viper.SetDefault("neo4j.user", "neo4j")
	viper.SetDefault("neo4j.password", "neo4j-change-me")
	
	viper.SetDefault("mcp.enabled", true)
	viper.SetDefault("mcp.plugins_dir", "./mcp-plugins")
	viper.SetDefault("mcp.hexridge_url", "http://localhost:3001")
	viper.SetDefault("mcp.pentagi_url", "http://localhost:3002")
	viper.SetDefault("mcp.ui_url", "http://localhost:3003")
	
	viper.SetDefault("frontend.url", "http://localhost:3000")
	viper.SetDefault("frontend.build_dir", "./dist")
	viper.SetDefault("frontend.api_base_url", "http://localhost:8080/api/v1")
	viper.SetDefault("frontend.ws_url", "ws://localhost:8080/ws")
	
	viper.SetDefault("security.jwt_secret", "change-me-in-production")
	viper.SetDefault("security.jwt_expires_in", "24h")
	viper.SetDefault("security.cors_origin", "http://localhost:3000")
	viper.SetDefault("security.rate_limit_requests", 100)
	viper.SetDefault("security.rate_limit_window", "15m")
	viper.SetDefault("security.encryption_key", "")
	
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.file", "./logs/harbinger.log")
	viper.SetDefault("logging.max_size", "100MB")
	viper.SetDefault("logging.max_backups", 5)
	
	viper.SetDefault("external_tools.nikto", "/usr/bin/nikto")
	viper.SetDefault("external_tools.dirsearch", "/opt/dirsearch")
	viper.SetDefault("external_tools.nuclei", "/usr/bin/nuclei")
	viper.SetDefault("external_tools.burp", "/usr/bin/burpsuite")
	viper.SetDefault("external_tools.owasp_zap", "/usr/bin/zaproxy")
	viper.SetDefault("external_tools.sqlmap", "/usr/bin/sqlmap")
	viper.SetDefault("external_tools.metasploit", "/usr/bin/msfconsole")
	
	viper.SetDefault("bug_bounty.hackerone.api_url", "https://api.hackerone.com")
	viper.SetDefault("bug_bounty.bugcrowd.api_url", "https://api.bugcrowd.com")
	viper.SetDefault("bug_bounty.intigriti.api_url", "https://api.intigriti.com")
	viper.SetDefault("bug_bounty.bugcrowd.github.api_url", "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/refs/heads/main/data/bugcrowd_data.json")
	viper.SetDefault("bug_bounty.federacy.github.api_url", "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/refs/heads/main/data/federacy_data.json")
	viper.SetDefault("bug_bounty.hackerone.github.api_url", "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/refs/heads/main/data/hackerone_data.json")
	viper.SetDefault("bug_bounty.intigriti.github.api_url", "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/refs/heads/main/data/intigriti_data.json")
	viper.SetDefault("bug_bounty.yeswehack.github.api_url", "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/refs/heads/main/data/yeswehack_data.json")

	viper.SetDefault("monitoring.metrics_enabled", true)
	viper.SetDefault("monitoring.metrics_port", 9090)
	viper.SetDefault("monitoring.health_check_interval", "30s")
	viper.SetDefault("monitoring.prometheus_endpoint", "http://localhost:9091")
}

func (c *Config) Validate() error {
	if c.App.Env == "production" {
		if c.Database.Password == "" || c.Database.Password == "change-me" {
			return fmt.Errorf("database password must be changed in production")
		}
		if c.Security.JWTSecret == "change-me-in-production" {
			return fmt.Errorf("JWT secret must be changed in production")
		}
		if c.Neo4j.Password == "neo4j-change-me" {
			return fmt.Errorf("Neo4j password must be changed in production")
		}
	}
	
	if c.App.Port < 1024 || c.App.Port > 65535 {
		return fmt.Errorf("APP_PORT must be between 1024 and 65535")
	}
	
	return nil
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%v",
		c.Database.Host, c.Database.Port, c.Database.User, c.Database.Password, c.Database.Name, c.Database.SSL)
}

func (c *Config) GetRedisURL() string {
	if c.Redis.Password != "" {
		// Redis URL format: redis://[username]:[password]@host:port/db — username intentionally empty for standard Redis auth
		return fmt.Sprintf("redis://%s:%s@%s:%d/%d", "", c.Redis.Password, c.Redis.Host, c.Redis.Port, c.Redis.DB)
	}
	return fmt.Sprintf("redis://%s:%d/%d", c.Redis.Host, c.Redis.Port, c.Redis.DB)
}

func (c *Config) GetNeo4jURL() string {
	return fmt.Sprintf("bolt://%s:%s@%s:%d", c.Neo4j.User, c.Neo4j.Password, c.Neo4j.Host, c.Neo4j.Port)
}

func (c *Config) String() string {
	return fmt.Sprintf("Harbinger Config: %s v%s (%s) on %s:%d",
		c.App.Name, c.App.Version, c.App.Env, c.App.Host, c.App.Port)
}
