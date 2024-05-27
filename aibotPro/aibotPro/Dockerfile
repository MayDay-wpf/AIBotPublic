# 使用官方 .NET SDK 镜像作为构建环境
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build-env
WORKDIR /app

# 复制 csproj 并还原依赖项
COPY *.csproj ./
RUN dotnet restore

# 复制项目文件并构建发布版本
COPY . ./
RUN dotnet publish -c Release -o out

# 使用官方 .NET 运行时镜像生成最终镜像
FROM mcr.microsoft.com/dotnet/aspnet:6.0
WORKDIR /app
COPY --from=build-env /app/out .
ENTRYPOINT ["dotnet", "aibotPro.dll"]