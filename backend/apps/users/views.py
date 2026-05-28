from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


def _set_jwt_cookies(response, access: str, refresh: str | None = None):
    """Escribe los tokens en cookies HttpOnly. SameSite/Secure desde settings."""
    common = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": "/",
    }
    access_max = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(settings.JWT_ACCESS_COOKIE, access, max_age=access_max, **common)
    if refresh is not None:
        refresh_max = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
        response.set_cookie(settings.JWT_REFRESH_COOKIE, refresh, max_age=refresh_max, **common)
    return response


@method_decorator(ensure_csrf_cookie, name="get")
class CSRFView(APIView):
    """GET para sembrar la cookie `csrftoken` antes de hacer escrituras."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrftoken": get_token(request)})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user = authenticate(
            request,
            username=request.data.get("email"),
            password=request.data.get("password"),
        )
        if user is None:
            return Response(
                {"detail": "Credenciales inválidas."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        refresh = RefreshToken.for_user(user)
        response = Response(UserSerializer(user).data)
        return _set_jwt_cookies(response, str(refresh.access_token), str(refresh))


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if not raw:
            return Response(
                {"detail": "No hay refresh token."}, status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            refresh = RefreshToken(raw)
            access = str(refresh.access_token)
            new_refresh = str(refresh) if settings.SIMPLE_JWT["ROTATE_REFRESH_TOKENS"] else None
        except TokenError:
            return Response(
                {"detail": "Refresh token inválido."}, status=status.HTTP_401_UNAUTHORIZED
            )
        response = Response({"detail": "ok"})
        return _set_jwt_cookies(response, access, new_refresh)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.JWT_ACCESS_COOKIE, path="/")
        response.delete_cookie(settings.JWT_REFRESH_COOKIE, path="/")
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ForgotPasswordView(APIView):
    """Solicita el envío del email con link de reseteo.

    Siempre responde 200 (con o sin email registrado) para no permitir
    enumeración de cuentas. El email se manda solo si el usuario existe.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if email:
            user = User.objects.filter(email__iexact=email).first()
            if user and user.is_active:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                base = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
                link = f"{base}/recuperar/{uid}/{token}"
                send_mail(
                    subject="Recupera tu contraseña · Clasificados VIP",
                    message=(
                        f"Hola,\n\n"
                        f"Recibimos una solicitud para recuperar la contraseña de tu "
                        f"cuenta en Clasificados VIP. Si fuiste tú, abre este link "
                        f"para crear una nueva contraseña:\n\n{link}\n\n"
                        f"El link es válido por unas pocas horas. Si no pediste esto, "
                        f"ignora este mensaje.\n"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=True,
                )
        return Response({"detail": "Si el correo existe, recibirás un mensaje en breve."})


class ResetPasswordView(APIView):
    """Recibe uid+token+password y resetea la contraseña."""

    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        password = request.data.get("password", "")

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"detail": "Link inválido o expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Link inválido o expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(password, user)
        except ValidationError as e:
            return Response({"password": e.messages}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Contraseña actualizada."})
