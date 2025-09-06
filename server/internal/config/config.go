package config

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

type Config struct {
	Server      ServerConfig      `json:"server"`
	RAGService  RAGServiceConfig  `json:"rag_service"`
	Database    DatabaseConfig    `json:"database"`
	Redis       RedisConfig       `json:"redis"`
	RateLimit   RateLimitConfig   `json:"rate_limit"`
}

type ServerConfig struct {
	Port         string `json:"port"`
	Host         string `json:"host"`
	Environment  string `json:"environment"`
	ReadTimeout  int    `json:"read_timeout"`
	WriteTimeout int    `json:"write_timeout"`
}

type RAGServiceConfig struct {
	URL            string `json:"url"`
	Timeout        int    `json:"timeout"`
	Retries        int    `json:"retries"`
	HealthCheckURL string `json:"health_check_url"`
}

type DatabaseConfig struct {
	URL             string `json:"url"`
	MaxConnections  int    `json:"max_connections"`
	MaxIdleTime     int    `json:"max_idle_time"`
	ConnMaxLifetime int    `json:"conn_max_lifetime"`
}

type RedisConfig struct {
	URL      string `json:"url"`
	Password string `json:"password"`
	DB       int    `json:"db"`
}

type RateLimitConfig struct {
	ClaudeRPM     int `json:"claude_rpm"`
	UserRPS       int `json:"user_rps"`
	BurstSize     int `json:"burst_size"`
	MaxConcurrent int `json:"max_concurrent"`
}

func Load() (*Config, error) {
	// Load .env file if it exists
	if err := godotenv.Load(".env"); err != nil {
		slog.Info("No .env file found in current directory, trying relative paths", "error", err)
		// Try loading from parent directory too
		if err := godotenv.Load("../.env"); err != nil {
			slog.Warn("No .env file found, using environment variables", "error", err)
		}
	} else {
		slog.Info(".env file loaded successfully")
	}

	// Set environment variable prefix for additional config
	viper.SetEnvPrefix("ARTICLE_CHAT")
	viper.AutomaticEnv()

	// Set defaults
	setDefaults()

	// Try to read config file for additional settings
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	
	if err := viper.ReadInConfig(); err != nil {
		slog.Debug("No YAML config file found, using environment variables and defaults")
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("unable to decode config: %w", err)
	}

	// Override with environment variables directly
	if ragURL := os.Getenv("RAG_SERVICE_URL"); ragURL != "" {
		config.RAGService.URL = ragURL
		slog.Info("RAG service URL loaded from environment")
	}
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		config.Database.URL = dbURL
	}
	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		config.Redis.URL = redisURL
	}
	if port := os.Getenv("PORT"); port != "" {
		config.Server.Port = port
	}
	if host := os.Getenv("HOST"); host != "" {
		config.Server.Host = host
	}

	// Debug log the loaded configuration (without sensitive URLs)
	slog.Info("Configuration loaded",
		"server_port", config.Server.Port,
		"server_host", config.Server.Host,
		"environment", config.Server.Environment)

	// Validate required fields
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.environment", "development")
	viper.SetDefault("server.read_timeout", 30)
	viper.SetDefault("server.write_timeout", 30)

	// RAG Service defaults
	viper.SetDefault("rag_service.url", "http://rag-service:3001")
	viper.SetDefault("rag_service.timeout", 120)
	viper.SetDefault("rag_service.retries", 3)
	viper.SetDefault("rag_service.health_check_url", "/api/health")

	// Database defaults
	viper.SetDefault("database.url", "postgresql://user:pass@localhost:5432/articledb")
	viper.SetDefault("database.max_connections", 25)
	viper.SetDefault("database.max_idle_time", 15)
	viper.SetDefault("database.conn_max_lifetime", 300)

	// Redis defaults
	viper.SetDefault("redis.url", "redis://localhost:6379")
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)

	// Rate limit defaults
	viper.SetDefault("rate_limit.user_rps", 10)
	viper.SetDefault("rate_limit.burst_size", 20)
	viper.SetDefault("rate_limit.max_concurrent", 100)

	// Bind environment variables
	viper.BindEnv("rag_service.url", "RAG_SERVICE_URL")
	viper.BindEnv("database.url", "DATABASE_URL")
	viper.BindEnv("redis.url", "REDIS_URL")
	viper.BindEnv("server.port", "PORT")
	viper.BindEnv("server.host", "HOST")
	viper.BindEnv("server.environment", "GO_ENV")
}

func validateConfig(config *Config) error {
	// Debug logging (without sensitive URLs)
	slog.Debug("Config validation", 
		"has_rag_service_url", config.RAGService.URL != "",
		"has_database_url", config.Database.URL != "")

	if config.RAGService.URL == "" {
		return fmt.Errorf("RAG_SERVICE_URL is required")
	}

	if config.Database.URL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	return nil
}