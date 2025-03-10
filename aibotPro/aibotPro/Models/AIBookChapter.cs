﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
#nullable disable
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace aibotPro.Models
{
    public partial class AIBookChapter
    {
        [Key]
        public int Id { get; set; }
        [StringLength(50)]
        public string ParentCode { get; set; }
        [StringLength(50)]
        public string Account { get; set; }
        [StringLength(100)]
        public string ChapterTitle { get; set; }
        [StringLength(3000)]
        public string ChapterSummary { get; set; }
        public string ChapterBody { get; set; }
        public int? WordCount { get; set; }
        public int? Seq { get; set; }
        [Column(TypeName = "datetime")]
        public DateTime? CreateTime { get; set; }
    }
}