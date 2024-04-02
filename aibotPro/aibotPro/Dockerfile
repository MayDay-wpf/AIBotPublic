#See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

#Depending on the operating system of the host machines(s) that will build or run the containers, the image specified in the FROM statement may need to be changed.
#For more information, please see https://aka.ms/containercompat

FROM mcr.microsoft.com/dotnet/aspnet:6.0-nanoserver-1809 AS base
WORKDIR /app
EXPOSE 80
# 安装 SQL Server 和 Redis
RUN apk update \
    && apk add --no-cache wget \
    && wget -O mssql-tools.rmp https://packages.microsoft.com/rhel/8/prod/mssql-tools-17.9.1.1-1.x86_64.rpm \
    && rpm -ivh mssql-tools.rmp \
    && apk add --no-cache redis \
    && rm mssql-tools.rmp

FROM mcr.microsoft.com/dotnet/sdk:6.0-alpine AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["aibotPro/aibotPro.csproj", "aibotPro/"]
RUN dotnet restore "./aibotPro/aibotPro.csproj"
COPY . .
WORKDIR "/src/aibotPro"
RUN dotnet build "./aibotPro.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./aibotPro.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# 启动 SQL Server 和 Redis
RUN redis-server --daemonize yes \
    && /opt/mssql-tools/bin/sqlservr &

ENTRYPOINT ["dotnet", "aibotPro.dll"]