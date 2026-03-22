from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "harbinger"
    db_user: str = "harbinger"
    db_password: str = ""
    db_sslmode: str = "disable"
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str = ""
    jwt_secret: str = ""
    docker_host: str = "tcp://docker-proxy:2375"
    docker_network: str = "harbinger_harbinger-network"
    port: int = 8000
    app_env: str = "development"
    log_level: str = "info"
    ollama_url: str = "http://host.docker.internal:11434"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
