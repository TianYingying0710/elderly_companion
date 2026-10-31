from typing import Annotated

from fastapi import Path, Query

# 路径 ID：至少一个非空白字符，纯空白由 FastAPI 判 422
ResourceId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]

# 列表分页上限，避免无界查询
PageLimit = Annotated[int, Query(ge=1, le=100)]
