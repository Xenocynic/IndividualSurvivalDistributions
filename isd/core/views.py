from rest_framework.response import Response
from rest_framework.views import APIView

class HealthCheckView(APIView):
    """Simple endpoint to verify API is alive."""
    def get(self, request):
        return Response({"status": "ok"})

class APIRootView(APIView):
    """API entrypoint overview."""
    def get(self, request):
        return Response({
            "auth": "/api/auth/",
            "predictor": "/api/predictor/",
            "dataset": "/api/dataset/",
            "health": "/api/health/",
        })
