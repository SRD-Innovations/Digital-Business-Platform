from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_env: str = "development"
    api_cors_origins: str = (
        "http://localhost:3000,"
        "https://biznet.srdinnovations.tech,"
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
    payhere_merchant_id: str = ""
    payhere_merchant_secret: str = ""
    platform_admin_emails: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]

    @property
    def platform_admin_email_set(self) -> set[str]:
        return {email.strip().lower() for email in self.platform_admin_emails.split(",") if email.strip()}


settings = Settings()
