USE [master]
GO
/****** Object:  Database [AIBotPro]    Script Date: 2025/2/19 15:55:31 ******/
CREATE DATABASE [AIBotPro]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'AIBotPro', FILENAME = N'C:\Program Files (x86)\Microsoft SQL Server\MSSQL11.MSSQLSERVER\MSSQL\DATA\AIBotPro.mdf' , SIZE = 1199104KB , MAXSIZE = UNLIMITED, FILEGROWTH = 1024KB )
 LOG ON 
( NAME = N'AIBotPro_log', FILENAME = N'C:\Program Files (x86)\Microsoft SQL Server\MSSQL11.MSSQLSERVER\MSSQL\DATA\AIBotPro_log.ldf' , SIZE = 2182144KB , MAXSIZE = 2048GB , FILEGROWTH = 30720KB )
GO
ALTER DATABASE [AIBotPro] SET COMPATIBILITY_LEVEL = 110
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [AIBotPro].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [AIBotPro] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [AIBotPro] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [AIBotPro] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [AIBotPro] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [AIBotPro] SET ARITHABORT OFF 
GO
ALTER DATABASE [AIBotPro] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [AIBotPro] SET AUTO_CREATE_STATISTICS ON 
GO
ALTER DATABASE [AIBotPro] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [AIBotPro] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [AIBotPro] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [AIBotPro] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [AIBotPro] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [AIBotPro] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [AIBotPro] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [AIBotPro] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [AIBotPro] SET  DISABLE_BROKER 
GO
ALTER DATABASE [AIBotPro] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [AIBotPro] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [AIBotPro] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [AIBotPro] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [AIBotPro] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [AIBotPro] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [AIBotPro] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [AIBotPro] SET RECOVERY FULL 
GO
ALTER DATABASE [AIBotPro] SET  MULTI_USER 
GO
ALTER DATABASE [AIBotPro] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [AIBotPro] SET DB_CHAINING OFF 
GO
ALTER DATABASE [AIBotPro] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [AIBotPro] SET TARGET_RECOVERY_TIME = 0 SECONDS 
GO
EXEC sys.sp_db_vardecimal_storage_format N'AIBotPro', N'ON'
GO
USE [AIBotPro]
GO
/****** Object:  StoredProcedure [dbo].[GetChatHistoriesList]    Script Date: 2025/2/19 15:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[GetChatHistoriesList]
    @Account NVARCHAR(255),
    @PageIndex INT = NULL,
    @PageSize INT = NULL,
    @SearchKey NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 直接获取 ChatHistory 列表 (分页)
    ;WITH EarliestChatHistories AS (
        SELECT
            ChatId AS Id,
            Account,
            Role,
            CreateTime,
            IsDel,
            Chat,          -- 未解码
            ChatTitle,     -- 未解码
            IsLock,
            IsTop,
            ROW_NUMBER() OVER (PARTITION BY ChatId ORDER BY CreateTime ASC) AS RowNum
        FROM
            ChatHistory
        WHERE
            Account = @Account
            AND IsDel <> 1
            AND Role = 'user'
            AND (CollectionCode IS NULL OR CollectionCode = '')
    )
    SELECT
        Id,
        Account,
        Role,
        CreateTime,
        IsDel,
        Chat,          -- 未解码
        ChatTitle,     -- 未解码
        ISNULL(IsLock, 0) AS IsLock,
        IsTop
    FROM
        EarliestChatHistories
    WHERE
        RowNum = 1
        AND (@SearchKey IS NULL OR Chat LIKE '%' + @SearchKey + '%') -- 搜索未解码的 Chat
    ORDER BY
        IsTop DESC,
        CreateTime DESC
    OFFSET (@PageIndex - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  Table [dbo].[__EFMigrationsHistory]    Script Date: 2025/2/19 15:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[__EFMigrationsHistory](
	[MigrationId] [nvarchar](150) NOT NULL,
	[ProductVersion] [nvarchar](32) NOT NULL,
 CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY CLUSTERED 
(
	[MigrationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Admins]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Admins](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
 CONSTRAINT [PK_Admins] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AIBookChapters]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AIBookChapters](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ParentCode] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[ChapterTitle] [nvarchar](100) NULL,
	[ChapterSummary] [nvarchar](3000) NULL,
	[ChapterBody] [nvarchar](max) NULL,
	[WordCount] [int] NULL,
	[Seq] [int] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_AIBookChapters] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AIBookPortraitImages]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AIBookPortraitImages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[BookCode] [nvarchar](50) NULL,
	[PortraitImage] [nvarchar](max) NULL,
	[Overview] [nvarchar](max) NULL,
	[LastChapterId] [int] NULL,
	[IsDel] [bit] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_AIBookPortraitImages] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AIBooks]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AIBooks](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[BookCode] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[BookName] [nvarchar](50) NULL,
	[BookThumbnail] [nvarchar](1000) NULL,
	[BookImg] [nvarchar](1000) NULL,
	[BookType] [nvarchar](50) NULL,
	[BookRemark] [nvarchar](1000) NULL,
	[BookTag] [nvarchar](500) NULL,
	[BookWordCount] [int] NULL,
	[IsPublic] [bit] NULL,
	[IsDel] [bit] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_AIBook] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AIdraw]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AIdraw](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ModelName] [nvarchar](50) NULL,
	[BaseUrl] [nvarchar](100) NULL,
	[ApiKey] [nvarchar](100) NULL,
	[Channel] [nvarchar](50) NULL,
 CONSTRAINT [PK_AIdraw] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AIdrawRes]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AIdrawRes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](100) NULL,
	[AImodel] [nvarchar](50) NULL,
	[ImgSavePath] [nvarchar](max) NULL,
	[Prompt] [nvarchar](max) NULL,
	[ReferenceImgPath] [nvarchar](max) NULL,
	[ThumbSavePath] [nvarchar](max) NULL,
	[ThumbKey] [nvarchar](max) NULL,
	[CreateTime] [datetime] NULL,
	[IsDel] [int] NULL,
 CONSTRAINT [PK_AIdrawRes] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AImodels]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AImodels](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ModelNick] [nvarchar](200) NULL,
	[ModelName] [nvarchar](200) NULL,
	[BaseUrl] [nvarchar](100) NULL,
	[ApiKey] [nvarchar](100) NULL,
	[ModelInfo] [nvarchar](500) NULL,
	[ModelGroup] [nvarchar](500) NULL,
	[AdminPrompt] [nvarchar](max) NULL,
	[VisionModel] [bit] NULL,
	[Seq] [int] NULL,
	[Delay] [int] NULL,
 CONSTRAINT [PK_AImodels] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AImodelsUserSeq]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AImodelsUserSeq](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](500) NULL,
	[ModelNick] [nvarchar](1000) NULL,
	[ModelName] [nvarchar](1000) NULL,
	[Seq] [int] NULL,
 CONSTRAINT [PK_AImodelsUserSeq] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[APIKEY]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[APIKEY](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[ApiKey] [nvarchar](50) NULL,
 CONSTRAINT [PK_APIKEY] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AssistantFiles]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssistantFiles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[AssisId] [nvarchar](100) NULL,
	[FileId] [nvarchar](200) NULL,
	[FileName] [nvarchar](500) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_AssistantFiles] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AssistantGPT]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssistantGPT](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[AssisId] [nvarchar](50) NULL,
	[AssisName] [nvarchar](200) NULL,
	[AssisSystemPrompt] [nvarchar](max) NULL,
	[AssisModel] [nvarchar](50) NULL,
	[Codeinterpreter] [int] NULL,
	[Retrieval] [int] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_AssistantGPT] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[AssistantModelPrice]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssistantModelPrice](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ModelNick] [nvarchar](50) NULL,
	[ModelName] [nvarchar](50) NULL,
	[ApiKey] [nvarchar](200) NULL,
	[BaseUrl] [nvarchar](200) NULL,
	[InputPrice] [money] NULL,
	[OutputPrice] [money] NULL,
	[VipInputPrice] [money] NULL,
	[VipOutputPrice] [money] NULL,
	[Rebate] [decimal](18, 2) NULL,
	[VipRebate] [decimal](18, 2) NULL,
	[ConstantPrice] [money] NULL,
	[VipConstant] [money] NULL,
 CONSTRAINT [PK_AssistantModelPrice] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[BindNewApi]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BindNewApi](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](500) NULL,
	[ApiId] [int] NULL,
	[ApiUserName] [nvarchar](50) NULL,
 CONSTRAINT [PK_BindNewApi] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Card]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Card](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CardNo] [nvarchar](50) NULL,
	[Mcoin] [money] NULL,
	[VipType] [nvarchar](50) NULL,
	[VipDay] [int] NULL,
	[Account] [nvarchar](50) NULL,
	[UseAccount] [nvarchar](50) NULL,
	[Used] [int] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Card] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ChatCollection]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ChatCollection](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CollectionName] [nvarchar](50) NULL,
	[CollectionCode] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
	[IsDel] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ChatHistory]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ChatHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ChatId] [nvarchar](100) NULL,
	[ChatCode] [nvarchar](100) NULL,
	[ChatGroupId] [nvarchar](100) NULL,
	[ChatTitle] [nvarchar](3000) NULL,
	[Chat] [nvarchar](max) NULL,
	[Role] [nvarchar](50) NULL,
	[Model] [nvarchar](50) NULL,
	[Account] [nvarchar](100) NULL,
	[FirstTime] [nvarchar](50) NULL,
	[AllTime] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
	[IsDel] [int] NULL,
	[IsLock] [int] NULL,
	[IsTop] [bit] NULL,
	[CollectionCode] [nvarchar](50) NULL,
 CONSTRAINT [PK_ChatHistory] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ChatSetting]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ChatSetting](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ChatSettingKey] [nvarchar](500) NULL,
	[ChatSettingValue] [nvarchar](max) NULL,
	[Account] [nvarchar](200) NULL,
 CONSTRAINT [PK_ChatSetting] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[EasyPaySetting]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EasyPaySetting](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ShopId] [int] NULL,
	[ApiKey] [nvarchar](50) NULL,
	[SubmitUrl] [nvarchar](200) NULL,
	[CheckPayUrl] [nvarchar](200) NULL,
	[NotifyUrl] [nvarchar](200) NULL,
	[ReturnUrl] [nvarchar](200) NULL,
 CONSTRAINT [PK_EasyPaySetting] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ErrorBilling]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ErrorBilling](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[LogId] [int] NULL,
	[UseMoney] [money] NULL,
	[Cause] [nvarchar](2000) NULL,
	[Status] [int] NULL,
	[Reply] [nvarchar](2000) NULL,
	[CreateTime] [datetime] NULL,
	[HandlingTime] [datetime] NULL,
 CONSTRAINT [PK_ErrorBilling] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[FilesLib]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FilesLib](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FileCode] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[FileName] [nvarchar](500) NULL,
	[FilePath] [nvarchar](500) NULL,
	[FileType] [nvarchar](50) NULL,
	[ObjectPath] [nvarchar](500) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_FilesLib] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ForumNotifications]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ForumNotifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NULL,
	[FromAccountId] [int] NULL,
	[TopicId] [int] NULL,
	[CommentsId] [int] NULL,
	[NotificationContent] [nvarchar](max) NULL,
	[CreateTime] [datetime] NULL,
	[IsRead] [bit] NULL,
 CONSTRAINT [PK_ForumNotifications] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ForumTopic]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ForumTopic](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NULL,
	[TopicTitle] [nvarchar](1000) NULL,
	[TopicContent] [nvarchar](max) NULL,
	[TopicTags] [nvarchar](500) NULL,
	[CreateTime] [datetime] NULL,
	[hit] [bigint] NULL,
	[IsDel] [bit] NULL,
	[IsTop] [bit] NULL,
 CONSTRAINT [PK_ForumTopic] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ForumTopicAddendum]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ForumTopicAddendum](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NULL,
	[TopicId] [int] NULL,
	[AddendumContent] [nvarchar](max) NULL,
	[IsDel] [bit] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_ForumTopicAddendum] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ForumTopicComments]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ForumTopicComments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NULL,
	[TopicId] [int] NULL,
	[ParentId] [int] NULL,
	[CommentsContent] [nvarchar](max) NULL,
	[CreateTime] [datetime] NULL,
	[IsDel] [bit] NULL,
 CONSTRAINT [PK_ForumTopicComments] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ForumTopicStatement]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ForumTopicStatement](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NULL,
	[Emoji] [nvarchar](50) NULL,
	[TopicId] [int] NULL,
	[IsDel] [bit] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_ForumStatement] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ForumUserSetting]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ForumUserSetting](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NULL,
	[Introduction] [nvarchar](200) NULL,
	[WebSite] [nvarchar](100) NULL,
	[AccessToken] [nvarchar](50) NULL,
	[Points] [money] NULL,
	[Mute] [bit] NULL,
 CONSTRAINT [PK_ForumUserSetting] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Goods]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Goods](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[GoodCode] [nvarchar](50) NULL,
	[GoodName] [nvarchar](500) NULL,
	[GoodInfo] [nvarchar](1000) NULL,
	[GoodImage] [nvarchar](500) NULL,
	[GoodPrice] [money] NULL,
	[GoodPayType] [nvarchar](50) NULL,
	[GoodStock] [int] NULL,
	[VIPDays] [int] NULL,
	[VIPType] [nvarchar](50) NULL,
	[Balance] [money] NULL,
	[OnShelves] [bit] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Goods] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[IPlook]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IPlook](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IPv4] [nvarchar](50) NULL,
	[Address] [nvarchar](50) NULL,
	[LookTime] [datetime] NULL,
 CONSTRAINT [PK_IPlook] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Knowledge]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Knowledge](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FileCode] [nvarchar](100) NULL,
	[FileName] [nvarchar](500) NULL,
	[FilePath] [nvarchar](500) NULL,
	[TypeCode] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Knowledge] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[KnowledgeList]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[KnowledgeList](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FileCode] [nvarchar](50) NULL,
	[VectorId] [nvarchar](100) NULL,
	[Account] [nvarchar](50) NULL,
 CONSTRAINT [PK_KnowledgeList] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[KnowledgeType]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[KnowledgeType](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[TypeName] [nvarchar](500) NULL,
	[TypeCode] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_KonwledgeType] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ModelPrice]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ModelPrice](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ModelName] [nvarchar](50) NULL,
	[ModelPriceInput] [money] NULL,
	[ModelPriceOutput] [money] NULL,
	[VipModelPriceInput] [money] NULL,
	[VipModelPriceOutput] [money] NULL,
	[SvipModelPriceInput] [money] NULL,
	[SvipModelPriceOutput] [money] NULL,
	[Rebate] [decimal](18, 2) NULL,
	[VipRebate] [decimal](18, 2) NULL,
	[SvipRebate] [decimal](18, 2) NULL,
	[Maximum] [money] NULL,
	[OnceFee] [money] NULL,
	[VipOnceFee] [money] NULL,
	[SvipOnceFee] [money] NULL,
 CONSTRAINT [PK_ModelPrice] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[MutedUsers]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MutedUsers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[StartTime] [datetime] NULL,
	[EndTime] [datetime] NULL,
 CONSTRAINT [PK_MutedUsers] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[NewApiCollectLog]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NewApiCollectLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[Limit] [money] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_NewApiCollectLog] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Notice]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Notice](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[NoticeTitle] [nvarchar](3000) NULL,
	[NoticeContent] [nvarchar](max) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Notice] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[NoticeRead]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NoticeRead](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[NoticeId] [int] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_NoticeRead] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[OpenAPIModelSetting]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OpenAPIModelSetting](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[FromModelName] [nvarchar](500) NULL,
	[ToModelName] [nvarchar](500) NULL,
 CONSTRAINT [PK_OpenAPIModelSetting] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Orders]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Orders](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[OrderCode] [nvarchar](50) NULL,
	[OrderMoney] [money] NULL,
	[OrderType] [nvarchar](500) NULL,
	[OrderStatus] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Orders] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Plugins]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Plugins](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Pcode] [nvarchar](50) NULL,
	[Account] [nvarchar](100) NULL,
	[Pavatar] [nvarchar](100) NULL,
	[Pnickname] [nvarchar](50) NULL,
	[Pfunctionname] [nvarchar](200) NULL,
	[Pfunctioninfo] [nvarchar](1000) NULL,
	[Popensource] [nvarchar](50) NULL,
	[Pluginprice] [money] NULL,
	[Pcodemodel] [nvarchar](50) NULL,
	[Papiurl] [nvarchar](200) NULL,
	[Pmethod] [nvarchar](50) NULL,
	[ParamCode] [nvarchar](50) NULL,
	[PheadersCode] [nvarchar](50) NULL,
	[PcookiesCode] [nvarchar](50) NULL,
	[Pjscode] [nvarchar](max) NULL,
	[PrunLocation] [nvarchar](50) NULL,
	[Pusehtml] [nvarchar](50) NULL,
	[IsPublic] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Plugins] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[PluginsCookies]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PluginsCookies](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CkCode] [nvarchar](50) NULL,
	[CkName] [nvarchar](500) NULL,
	[CkValue] [nvarchar](max) NULL,
 CONSTRAINT [PK_PluginsCookies] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[PluginsHeaders]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PluginsHeaders](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[HdCode] [nvarchar](50) NULL,
	[HdName] [nvarchar](500) NULL,
	[HdValue] [nvarchar](max) NULL,
 CONSTRAINT [PK_PluginsHeaders] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[PluginsInstall]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PluginsInstall](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[PluginsCode] [nvarchar](50) NULL,
	[MustHit] [bit] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_PluginsInstall] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[PluginsJsonPr]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PluginsJsonPr](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PrCode] [nvarchar](50) NULL,
	[JsonContent] [nvarchar](max) NULL,
 CONSTRAINT [PK_PluginsJsonPr] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[PluginsParams]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PluginsParams](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PrCode] [nvarchar](50) NULL,
	[PrName] [nvarchar](200) NULL,
	[PrType] [nvarchar](50) NULL,
	[PrInfo] [nvarchar](1000) NULL,
	[PrConst] [nvarchar](500) NULL,
 CONSTRAINT [PK_Params] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[RoleChat]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoleChat](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleChatCode] [nvarchar](50) NULL,
	[UserInput] [nvarchar](max) NULL,
	[AssistantOutput] [nvarchar](max) NULL,
 CONSTRAINT [PK_RoleChat] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[RoleSetting]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoleSetting](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleCode] [nvarchar](50) NULL,
	[RoleAvatar] [nvarchar](500) NULL,
	[RoleName] [nvarchar](50) NULL,
	[RoleInfo] [nvarchar](1000) NULL,
	[RoleSystemPrompt] [nvarchar](max) NULL,
	[RoleChatCode] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_RoleSetting] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Share]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Share](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[ParentAccount] [nvarchar](50) NULL,
	[ShareCode] [nvarchar](50) NULL,
	[Mcoin] [money] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Share] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[ShareLog]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShareLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[LogTxt] [nvarchar](max) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_ShareLog] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[SignIn]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SignIn](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_SignIn] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[SunoRes]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SunoRes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[TaskId] [nvarchar](50) NULL,
	[SongId] [nvarchar](50) NULL,
	[ImageUrl] [nvarchar](500) NULL,
	[ImageCosKey] [nvarchar](500) NULL,
	[ImageLargeUrl] [nvarchar](500) NULL,
	[ImageLargeCosKey] [nvarchar](500) NULL,
	[AudioUrl] [nvarchar](500) NULL,
	[AudioCosKey] [nvarchar](500) NULL,
	[VideoUrl] [nvarchar](500) NULL,
	[VideoCosKey] [nvarchar](500) NULL,
	[Title] [nvarchar](500) NULL,
	[Prompt] [nvarchar](3000) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_SunoRes] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[SystemCfg]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemCfg](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CfgCode] [nvarchar](50) NULL,
	[CfgName] [nvarchar](100) NULL,
	[CfgKey] [nvarchar](50) NULL,
	[CfgValue] [nvarchar](max) NULL,
 CONSTRAINT [PK_SystemCfg] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[SystemLog]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[LogLevel] [nvarchar](50) NULL,
	[LogTxt] [nvarchar](max) NULL,
	[CreateAccount] [nvarchar](50) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_SystemLog] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[SystemPlugins]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemPlugins](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[ApiKey] [nvarchar](50) NULL,
	[Pfunctionname] [nvarchar](50) NULL,
 CONSTRAINT [PK_SystemPlugins] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[SystemPluginsInstall]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemPluginsInstall](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[PluginName] [nvarchar](500) NULL,
 CONSTRAINT [PK_SystemPluginsInstall] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[TxOrders]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TxOrders](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[AliAccount] [nvarchar](500) NULL,
	[Money] [money] NULL,
	[IsOver] [int] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_TxOrders] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[UISetting]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UISetting](
	[Id] [int] NOT NULL,
	[Account] [nvarchar](50) NULL,
	[SettingKey] [nvarchar](50) NULL,
	[SettingValue] [nvarchar](max) NULL,
 CONSTRAINT [PK_UISetting] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[UserPrompt]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserPrompt](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[Prompt] [nvarchar](max) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_UserPrompt] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[Users]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserCode] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[Password] [nvarchar](50) NULL,
	[Nick] [nvarchar](50) NULL,
	[HeadImg] [nvarchar](100) NULL,
	[Sex] [nvarchar](50) NULL,
	[Mcoin] [money] NULL,
	[IsBan] [int] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[UserSetting]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserSetting](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](100) NULL,
	[UseHistory] [int] NULL,
	[GoodHistory] [int] NULL,
	[HistoryCount] [int] NULL,
	[Scrolling] [int] NULL,
	[MyAPIUrl] [nvarchar](100) NULL,
	[MyAPIKey] [nvarchar](100) NULL,
 CONSTRAINT [PK_UserSetting] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[UsersLimit]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UsersLimit](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[ModelName] [nvarchar](50) NULL,
	[Limit] [int] NULL,
	[Enable] [bit] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_UsersLimit] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[UsersMessage]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UsersMessage](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[MessageCode] [nvarchar](50) NULL,
	[MessageContent] [nvarchar](max) NULL,
	[MessageAttr] [nvarchar](3000) NULL,
	[MessageAttrType] [nvarchar](50) NULL,
	[MessageStatus] [int] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_UsersMessage] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[UseUpLog]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UseUpLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ModelName] [nvarchar](50) NULL,
	[Account] [nvarchar](50) NULL,
	[InputCount] [int] NULL,
	[OutputCount] [int] NULL,
	[UseMoney] [money] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_UseUpLog] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[VIP]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VIP](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[VipType] [nvarchar](50) NULL,
	[StartTime] [datetime] NULL,
	[EndTime] [datetime] NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_VIP] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  Table [dbo].[WorkFlow]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkFlow](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](50) NULL,
	[FlowCode] [nvarchar](50) NULL,
	[Pcode] [nvarchar](50) NULL,
	[FlowJson] [nvarchar](max) NULL,
	[CreateTime] [datetime] NULL,
 CONSTRAINT [PK_WorkFlow] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[WorkShopAIModel]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkShopAIModel](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ModelNick] [nvarchar](200) NULL,
	[ModelName] [nvarchar](200) NULL,
	[BaseUrl] [nvarchar](200) NULL,
	[ApiKey] [nvarchar](200) NULL,
	[ModelInfo] [nvarchar](500) NULL,
	[AdminPrompt] [nvarchar](max) NULL,
	[VisionModel] [bit] NULL,
	[Seq] [int] NULL,
	[Delay] [int] NULL,
	[Channel] [nvarchar](50) NULL,
 CONSTRAINT [PK_WorkShopAIModel] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
/****** Object:  Table [dbo].[WorkShopModelUserSeq]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkShopModelUserSeq](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Account] [nvarchar](500) NULL,
	[ModelNick] [nvarchar](1000) NULL,
	[ModelName] [nvarchar](1000) NULL,
	[Seq] [int] NULL,
 CONSTRAINT [PK_WorkShopModelUserSeq] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]

GO
/****** Object:  View [dbo].[IPlook_Stats_View]    Script Date: 2025/2/19 15:55:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE VIEW [dbo].[IPlook_Stats_View]
AS
SELECT 
    (SELECT COUNT(*) FROM IPlook) AS TotalClicks,
    (SELECT COUNT(*) FROM IPlook WHERE CONVERT(DATE, LookTime) = CONVERT(DATE, GETDATE())) AS TodayClicks,
    CONVERT(DATE, LookTime) AS Date,
    COUNT(*) AS Clicks
FROM
    IPlook
WHERE
    LookTime >= DATEADD(DAY, -7, GETDATE())
GROUP BY
    CONVERT(DATE, LookTime);

GO
ALTER TABLE [dbo].[AImodels] ADD  CONSTRAINT [DF_AImodels_VisionModel]  DEFAULT ((0)) FOR [VisionModel]
GO
ALTER TABLE [dbo].[ChatHistory] ADD  CONSTRAINT [DF_ChatHistory_IsTop]  DEFAULT ((0)) FOR [IsTop]
GO
ALTER TABLE [dbo].[ModelPrice] ADD  CONSTRAINT [DF_ModelPrice_OnceFee]  DEFAULT ((0)) FOR [OnceFee]
GO
ALTER TABLE [dbo].[ModelPrice] ADD  CONSTRAINT [DF_ModelPrice_VipOnceFee]  DEFAULT ((0)) FOR [VipOnceFee]
GO
ALTER TABLE [dbo].[PluginsInstall] ADD  CONSTRAINT [DF_PluginsInstall_MustHit]  DEFAULT ((0)) FOR [MustHit]
GO
USE [master]
GO
ALTER DATABASE [AIBotPro] SET  READ_WRITE 
GO

