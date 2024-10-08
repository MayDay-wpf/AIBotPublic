﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
#nullable disable
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace aibotPro.Models
{
    [Table("ModelPrice")]
    public partial class ModelPrice
    {
        [Key]
        public int Id { get; set; }
        [StringLength(50)]
        public string ModelName { get; set; }
        [Column(TypeName = "money")]
        public decimal? ModelPriceInput { get; set; }
        [Column(TypeName = "money")]
        public decimal? ModelPriceOutput { get; set; }
        [Column(TypeName = "money")]
        public decimal? VipModelPriceInput { get; set; }
        [Column(TypeName = "money")]
        public decimal? VipModelPriceOutput { get; set; }
        [Column(TypeName = "money")]
        public decimal? SvipModelPriceInput { get; set; }
        [Column(TypeName = "money")]
        public decimal? SvipModelPriceOutput { get; set; }
        [Column(TypeName = "decimal(18, 2)")]
        public decimal? Rebate { get; set; }
        [Column(TypeName = "decimal(18, 2)")]
        public decimal? VipRebate { get; set; }
        [Column(TypeName = "decimal(18, 2)")]
        public decimal? SvipRebate { get; set; }
        [Column(TypeName = "money")]
        public decimal? Maximum { get; set; }
        [Column(TypeName = "money")]
        public decimal? OnceFee { get; set; }
        [Column(TypeName = "money")]
        public decimal? VipOnceFee { get; set; }
        [Column(TypeName = "money")]
        public decimal? SvipOnceFee { get; set; }
    }
}