from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "gpt-4o-mini"
    openai_api_version: str = "2024-02-01"

    # Fallback OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Database
    database_url: str = "sqlite+aiosqlite:///./scrum_agent.db"

    # App
    secret_key: str = "changeme"
    cors_origins: str = "http://localhost:3000"
    debug: bool = False

    # Jira
    jira_url: str = ""
    jira_username: str = ""
    jira_api_token: str = ""
    jira_project_key: str = "KAN"

    # GitHub
    github_token: str = ""
    github_repo: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
