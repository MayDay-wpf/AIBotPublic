FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src

# 克隆 Git 仓库
RUN git clone https://github.com/MayDay-wpf/AIBotPublic.git .

# 进入包含解决方案文件的目录
WORKDIR /src/aibotPro

# 还原项目依赖项并发布项目
RUN dotnet restore "aibotPro.sln"
RUN dotnet publish "aibotPro.sln" -c Release -o /app/publish

# 第二阶段：基于 .NET 运行时镜像设置运行环境
FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
ENV Redis__EndPoints__0__Host=cache
ENV Redis__EndPoints__0__Port=6379
ENTRYPOINT ["dotnet", "aibotPro.dll"]
