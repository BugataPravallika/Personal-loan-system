"""Private Supabase Storage helpers with a local-development fallback."""
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "ezfinanz-private")


def storage_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def _object_url(object_path: str) -> str:
    base_url = SUPABASE_URL.rstrip("/")
    return f"{base_url}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{object_path}"


def upload_private_file(object_path: str, content: bytes, content_type: str | None) -> str:
    if not storage_enabled():
        raise RuntimeError("Supabase Storage is not configured.")

    request = Request(
        _object_url(object_path),
        data=content,
        method="POST",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "true",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            if response.status not in (200, 201):
                raise RuntimeError(f"Storage upload failed with status {response.status}.")
    except (HTTPError, URLError) as exc:
        raise RuntimeError("Supabase Storage upload failed.") from exc
    return object_path


def download_private_file(object_path: str) -> tuple[bytes, str | None]:
    if not storage_enabled():
        raise RuntimeError("Supabase Storage is not configured.")

    request = Request(
        _object_url(object_path),
        method="GET",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            return response.read(), response.headers.get_content_type()
    except (HTTPError, URLError) as exc:
        raise RuntimeError("Supabase Storage download failed.") from exc
