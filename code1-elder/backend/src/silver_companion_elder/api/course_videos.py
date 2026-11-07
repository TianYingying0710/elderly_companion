from typing import Annotated

from fastapi import APIRouter, File, Path, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse

from silver_companion_elder.errors import VideoNotFoundError
from silver_companion_elder.repositories.courses import get_course_repository
from silver_companion_elder.schemas.courses import CourseVideoUpload

router = APIRouter(prefix="/course-videos", tags=["course-videos"])

MAX_VIDEO_BYTES = 200 * 1024 * 1024  # 单个视频上限 200MB
ALLOWED_SUFFIX = ".mp4"
CHUNK_SIZE = 1024 * 1024

error_responses = {404: {"description": "视频不存在"}}


def _validation_error(message: str) -> RequestValidationError:
    return RequestValidationError(
        errors=[{"loc": ("file",), "msg": message, "type": "value_error"}]
    )


@router.post("", response_model=CourseVideoUpload, status_code=201)
async def upload_course_video(
    file: Annotated[UploadFile, File(...)],
) -> CourseVideoUpload:
    if file.filename is None or not file.filename.lower().endswith(ALLOWED_SUFFIX):
        raise _validation_error("仅支持 .mp4 视频文件")
    video_id, video_url = await get_course_repository().save_video(
        file, MAX_VIDEO_BYTES, CHUNK_SIZE
    )
    return CourseVideoUpload(video_id=video_id, video_url=video_url)


@router.get("/{video_id}", response_class=FileResponse, responses=error_responses)
async def stream_course_video(
    video_id: Annotated[str, Path(min_length=1, pattern=r".*\S.*")],
) -> FileResponse:
    path = get_course_repository().get_video_path(video_id)
    if path is None:
        raise VideoNotFoundError
    return FileResponse(path, media_type="video/mp4", filename=f"{video_id}.mp4")
