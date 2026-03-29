"""
Pipeline scheduler entry point.
Runs the geo-pipeline every PROCESSING_INTERVAL_DAYS days.
"""
import schedule
import time
import structlog

from .pipeline import run_pipeline
from .config import PROCESSING_INTERVAL_DAYS

logger = structlog.get_logger(__name__)


def main() -> None:
    logger.info(
        'scheduler_started',
        interval_days=PROCESSING_INTERVAL_DAYS,
    )

    # Run immediately on startup, then on schedule
    run_pipeline()

    schedule.every(PROCESSING_INTERVAL_DAYS).days.do(run_pipeline)

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == '__main__':
    main()
