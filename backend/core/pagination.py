from rest_framework.pagination import PageNumberPagination


class AdminPagination(PageNumberPagination):
    """Paginación de las listas del panel admin (reemplaza el tope fijo de 100)."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100
