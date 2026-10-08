from rest_framework.response import Response
from rest_framework.views import exception_handler

from .services import DealError


def api_error(code, detail, status=400):
    """
    One error format for the whole API: {"code": "...", "detail": "..."}.

    The frontend translates by `code` (RU/EN), so the API does not need to know the UI language.
    """
    return Response({'code': code, 'detail': detail}, status=status)


def api_exception_handler(exc, context):
    if isinstance(exc, DealError):
        return api_error(exc.code, exc.message)
    return exception_handler(exc, context)
