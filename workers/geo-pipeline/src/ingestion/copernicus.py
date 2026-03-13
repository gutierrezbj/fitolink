"""
Copernicus Data Space Ecosystem - Sentinel-2 data ingestion.
Downloads and processes Sentinel-2 L2A products for registered parcels.
"""
import requests
import structlog
from datetime import datetime, timedelta
from typing import Optional

from ..config import (
    COPERNICUS_CLIENT_ID,
    COPERNICUS_CLIENT_SECRET,
    COPERNICUS_TOKEN_URL,
    COPERNICUS_CATALOG_URL,
    CLOUD_COVER_MAX,
)

logger = structlog.get_logger(__name__)


class CopernicusClient:
    """Client for Copernicus Data Space Ecosystem APIs."""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    def _get_token(self) -> str:
        """Obtain or refresh OAuth2 token from Copernicus."""
        if self._token and self._token_expires and datetime.now() < self._token_expires:
            return self._token

        if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
            raise ValueError('Copernicus credentials not configured')

        response = requests.post(
            COPERNICUS_TOKEN_URL,
            data={
                'grant_type': 'client_credentials',
                'client_id': COPERNICUS_CLIENT_ID,
                'client_secret': COPERNICUS_CLIENT_SECRET,
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        self._token = data['access_token']
        self._token_expires = datetime.now() + timedelta(seconds=data.get('expires_in', 3600) - 60)
        logger.info('copernicus_token_obtained')
        return self._token

    def search_sentinel2(
        self,
        bbox: tuple[float, float, float, float],
        start_date: datetime,
        end_date: Optional[datetime] = None,
        max_cloud_cover: float = CLOUD_COVER_MAX,
    ) -> list[dict]:
        """
        Search for Sentinel-2 L2A products covering a bounding box.

        Args:
            bbox: (west, south, east, north) in WGS84
            start_date: Start of time range
            end_date: End of time range (defaults to now)
            max_cloud_cover: Maximum cloud cover percentage
        """
        if end_date is None:
            end_date = datetime.now()

        west, south, east, north = bbox
        aoi = f"OData.CSC.Intersects(area=geography'SRID=4326;POLYGON(({west} {south},{east} {south},{east} {north},{west} {north},{west} {south}))')"

        filter_str = (
            f"Collection/Name eq 'SENTINEL-2' and "
            f"Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A') and "
            f"{aoi} and "
            f"ContentDate/Start ge {start_date.strftime('%Y-%m-%dT00:00:00.000Z')} and "
            f"ContentDate/Start le {end_date.strftime('%Y-%m-%dT23:59:59.999Z')} and "
            f"Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' and att/OData.CSC.DoubleAttribute/Value le {max_cloud_cover})"
        )

        response = requests.get(
            f"{COPERNICUS_CATALOG_URL}/Products",
            params={
                '$filter': filter_str,
                '$orderby': 'ContentDate/Start desc',
                '$top': 5,
            },
            timeout=60,
        )
        response.raise_for_status()

        products = response.json().get('value', [])
        logger.info('sentinel2_search_completed', count=len(products), bbox=bbox)
        return products

    def download_product(self, product_id: str, output_path: str) -> str:
        """Download a Sentinel-2 product by ID."""
        token = self._get_token()

        url = f"{COPERNICUS_CATALOG_URL}/Products({product_id})/$value"
        response = requests.get(
            url,
            headers={'Authorization': f'Bearer {token}'},
            stream=True,
            timeout=300,
        )
        response.raise_for_status()

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.info('product_downloaded', product_id=product_id, path=output_path)
        return output_path
