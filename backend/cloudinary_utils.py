"""
cloudinary_utils.py — thin wrapper around the Cloudinary SDK.

Set these env vars (already added to Render):
  CLOUDINARY_CLOUD_NAME
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET
"""
import os
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key    = os.getenv("CLOUDINARY_API_KEY"),
    api_secret = os.getenv("CLOUDINARY_API_SECRET"),
    secure     = True,
)


def upload_photo(content: bytes, public_id: str) -> str:
    """
    Upload raw image bytes to Cloudinary.
    Returns the secure HTTPS URL of the uploaded image.
    public_id is used as the filename in Cloudinary (e.g. the profile UUID).
    """
    result = cloudinary.uploader.upload(
        content,
        public_id       = f"nats_matrimony/profiles/{public_id}",
        overwrite       = True,
        resource_type   = "image",
        transformation  = [{"quality": "auto", "fetch_format": "auto"}],
    )
    return result["secure_url"]


def delete_photo(public_id: str) -> None:
    """Delete a photo from Cloudinary (best-effort, never raises)."""
    try:
        cloudinary.uploader.destroy(f"nats_matrimony/profiles/{public_id}")
    except Exception:
        pass
