# ───────── Etapa 1: compilar el backend y empaquetar el frontend dentro ─────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY backend/gestion-productos/ backend/gestion-productos/
# El frontend se copia dentro del backend para que Spring Boot lo sirva
# (queda disponible en /frontend/..., igual que en tus enlaces actuales)
COPY frontend/ backend/gestion-productos/src/main/resources/static/frontend/

# En Linux importan las mayúsculas: tus enlaces apuntan a ayuda.html y funcionalidades.html
RUN cd backend/gestion-productos/src/main/resources/static/frontend/paginas/pagina-principal && \
    ( [ -f Ayuda.html ] && mv Ayuda.html ayuda.html || true ) && \
    ( [ -f Funcionalidades.html ] && mv Funcionalidades.html funcionalidades.html || true )

# La dirección raíz (/) redirige a la página principal
RUN printf '%s\n' \
  '<!DOCTYPE html><html><head><meta charset="utf-8">' \
  '<meta http-equiv="refresh" content="0; url=/frontend/paginas/pagina-principal/index.html">' \
  '<title>CAPCOB</title></head><body></body></html>' \
  > backend/gestion-productos/src/main/resources/static/index.html

RUN mvn -f backend/gestion-productos/pom.xml -DskipTests -B clean package

# ───────── Etapa 2: imagen final, liviana ─────────
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/backend/gestion-productos/target/*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=render
# El plan gratis de Render tiene 512 MB de memoria
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]