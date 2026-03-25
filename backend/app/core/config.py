from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from tzlocal import get_localzone_name

BASE_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "Diary API"
    api_prefix: str = ""
    database_url: str | None = None
    export_root: Path = BASE_DIR / "backend" / "exports"
    markdown_dir_name: str = "markdown"
    csv_file_name: str = "daily_entries.csv"
    scheduler_timezone: str = "UTC"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="DIARY_",
        extra="ignore",
    )

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        db_path = (BASE_DIR / "backend" / "data" / "diary.db").resolve()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"

    @property
    def markdown_root(self) -> Path:
        path = self.export_root / self.markdown_dir_name
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def csv_path(self) -> Path:
        self.export_root.mkdir(parents=True, exist_ok=True)
        return self.export_root / self.csv_file_name

    @property
    def resolved_scheduler_timezone(self) -> str:
        if self.scheduler_timezone.strip().lower() != "local":
            return self.scheduler_timezone
        try:
            return get_localzone_name()
        except Exception:
            return "UTC"


settings = Settings()
