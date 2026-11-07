from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from silver_companion_elder.errors import CourseNotFoundError
from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CourseSummary,
    CreateCourseRequest,
)
from silver_companion_elder.schemas.learning import LearningRecord

# 以下课程条目为虚构演示数据（演示阶段预置，不来自任何真实内容源）；
# 进程内存储，服务重启后学习记录、社区端新建课程与视频文件记录清空、
# 课程目录随演示数据重建。视频文件本体存放在 backend/data/uploads/videos/（不入 git）。

VIDEO_STORAGE_DIR = Path(__file__).resolve().parents[3] / "data" / "uploads" / "videos"


def _demo_courses() -> dict[str, CourseDetail]:
    catalog = [
        CourseDetail(
            id="course-smartphone-basics",
            title="智能手机基础操作",
            category="数字素养",
            description="从开关机到连 Wi-Fi，一步步学会手机日常使用。",
            duration_seconds=600,
            outline=["认识屏幕与按键", "连接无线网络", "调整字体大小", "安装常用应用"],
        ),
        CourseDetail(
            id="course-anti-fraud",
            title="防电信诈骗指南",
            category="安全防护",
            description="识别常见诈骗话术，守住养老钱袋子。",
            duration_seconds=900,
            outline=["冒充公检法套路", "保健品骗局", "陌生链接不要点", "遇到可疑来电怎么办"],
        ),
        CourseDetail(
            id="course-video-call",
            title="和家人视频通话",
            category="数字素养",
            description="学会与子女孙辈视频聊天，拉近距离。",
            duration_seconds=480,
            outline=["找到聊天应用", "发起视频通话", "接听与挂断"],
        ),
        CourseDetail(
            id="course-health-walking",
            title="居家健步走",
            category="健康运动",
            description="跟着口令在家安全锻炼，强度适中。",
            duration_seconds=1800,
            outline=["热身活动", "原地踏步节奏", "放松拉伸"],
        ),
        CourseDetail(
            id="course-emergency-sos",
            title="紧急求助按钮使用",
            category="安全防护",
            description="记住一键求助的位置与用法，关键时刻不慌张。",
            duration_seconds=300,
            outline=["按钮在哪里", "什么时候按", "按下之后会发生什么"],
        ),
    ]
    return {course.id: course for course in catalog}


class InMemoryCourseRepository:
    """课程目录（预置演示数据）与学习记录（进程内、重启即清）。"""

    def __init__(self) -> None:
        self._courses = _demo_courses()
        self._records: dict[str, LearningRecord] = {}
        self._videos: dict[str, Path] = {}

    def reset(self) -> None:
        """测试辅助：清空学习记录，恢复初始演示状态。"""
        self._records.clear()

    async def create_course(self, request: CreateCourseRequest) -> CourseDetail:
        """社区端创建课程（演示闭环：视频先上传拿到 video_id 再建课）。"""
        video_url = None
        if request.video_id is not None:
            if request.video_id not in self._videos:
                raise CourseNotFoundError
            video_url = f"/api/v1/course-videos/{request.video_id}"
        course_id = f"course-{uuid4().hex[:12]}"
        course = CourseDetail(
            id=course_id,
            title=request.title,
            category=request.category,
            description=request.description,
            duration_seconds=request.duration_seconds,
            outline=list(request.outline),
            video_url=video_url,
        )
        self._courses[course_id] = course
        return course

    async def save_video(
        self, file: UploadFile, max_bytes: int, chunk_size: int
    ) -> tuple[str, str]:
        """分块落盘上传视频，超出上限即中止并清理半成品。"""
        VIDEO_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        video_id = uuid4().hex[:12]
        target = VIDEO_STORAGE_DIR / f"{video_id}.mp4"
        written = 0
        try:
            with target.open("wb") as sink:
                while chunk := await file.read(chunk_size):
                    written += len(chunk)
                    if written > max_bytes:
                        raise ValueError("视频超出 200MB 上限")
                    sink.write(chunk)
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        self._videos[video_id] = target
        return video_id, f"/api/v1/course-videos/{video_id}"

    def get_video_path(self, video_id: str) -> Path | None:
        """仅返回本进程登记过的视频路径，重启后旧链接自然失效。"""
        return self._videos.get(video_id)

    async def list_courses(self) -> list[CourseSummary]:
        return [
            CourseSummary(
                id=course.id,
                title=course.title,
                category=course.category,
                description=course.description,
                duration_seconds=course.duration_seconds,
                video_url=course.video_url,
            )
            for course in self._courses.values()
        ]

    async def get_course(self, course_id: str) -> CourseDetail | None:
        return self._courses.get(course_id)

    async def list_records(self) -> list[LearningRecord]:
        return sorted(self._records.values(), key=lambda record: record.updated_at, reverse=True)

    async def upsert_record(self, course_id: str, progress_percent: int) -> LearningRecord | None:
        if course_id not in self._courses:
            return None
        record = LearningRecord(
            course_id=course_id,
            progress_percent=progress_percent,
            updated_at=datetime.now(timezone.utc),
        )
        self._records[course_id] = record
        return record


@lru_cache
def get_course_repository() -> InMemoryCourseRepository:
    """FastAPI 依赖：进程内单例仓库。"""
    return InMemoryCourseRepository()
