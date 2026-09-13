from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_env: str = "development"
    api_cors_origins: str = (
        "http://localhost:3000,"
        "https://srd-biz.vercel.app,"
        "https://srd-innovations.github.io"
    )
    supabase_url: str = ""
    database_url: str = ""
    jwt_secret: str = "change-me-in-development-use-a-long-random-value"
    jwt_expire_minutes: int = 480

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


settings = Settings()
