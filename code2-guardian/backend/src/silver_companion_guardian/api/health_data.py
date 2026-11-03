from fastapi import APIRouter, Depends, Path

from ..dependencies.health import get_health_data_service
from ..schemas.health_data import HealthOverviewDto
from ..services.health_data import HealthDataService

router = APIRouter(prefix="/api/v1")


@router.get("/health-overview/{elder_id}", response_model=HealthOverviewDto)
def health_overview(
    elder_id: str = Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$") ,
    service: HealthDataService = Depends(get_health_data_service),
) -> HealthOverviewDto:
    return service.get_overview(elder_id)
