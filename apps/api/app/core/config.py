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
    web_origin: str = "http://localhost:3000"
    oauth_redirect_base: str = "http://localhost:8000"
    google_client_id: str = ""
    google_client_secret: str = ""
    facebook_client_id: str = ""
    facebook_client_secret: str = ""
    tiktok_client_key: str = ""
    tiktok_client_secret: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


settings = Settings()
