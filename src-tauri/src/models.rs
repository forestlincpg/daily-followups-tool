use serde::{Deserialize, Deserializer, Serialize};

/// 自定义反序列化器：区分 JSON 字段缺失 vs 显式 null
/// - 字段缺失 → None（不更新）
/// - 字段为 null → Some(None)（置为 NULL）
/// - 字段有值 → Some(Some("..."))（更新为该值）
fn deserialize_optional_nullable<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

/// 跟进项数据模型，与数据库 follow_up_items 表字段一一对应。
/// 主任务和子任务共用同一 struct，通过 parent_id 区分。
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FollowUpItem {
    pub id: i64,
    /// None 表示顶级任务，Some(id) 表示子任务
    pub parent_id: Option<i64>,
    pub title: String,
    /// 取值: "todo" | "waiting" | "done" | "long_term"
    pub status: String,
    /// 等待的具体人员（status = "waiting" 时使用）
    pub waiting_for: Option<String>,
    /// 开始等待的时间
    pub waiting_since: Option<String>,
    /// 负责人
    pub owner: Option<String>,
    /// 截止日期，格式 "YYYY-MM-DD"
    pub due_date: Option<String>,
    /// 超链接列表，JSON 数组字符串，如 `[{"url":"...","label":"..."}]`
    pub links: String,
    /// 是否强调标记（整行高亮）
    pub is_emphasized: bool,
    /// 排序位置（REAL，拖拽时取相邻两项中间值）
    pub sort_order: f64,
    /// 备注
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

/// 创建跟进项时的输入参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemInput {
    pub title: String,
    pub parent_id: Option<i64>,
    pub owner: Option<String>,
    pub due_date: Option<String>,
}

/// 更新跟进项时的输入参数（所有字段均为 Option，仅传入需要变更的字段）
/// 可置空的字段使用 Option<Option<String>>：
///   - JSON 字段缺失 → None → 不更新
///   - JSON 字段为 null → Some(None) → 置为 NULL
///   - JSON 字段有值   → Some(Some("...")) → 更新为该值
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemInput {
    pub id: i64,
    pub title: Option<String>,
    pub status: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub waiting_for: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub waiting_since: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub owner: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub due_date: Option<Option<String>>,
    pub links: Option<String>,
    pub is_emphasized: Option<bool>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub notes: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub completed_at: Option<Option<String>>,
}

/// 查询跟进项的过滤参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetItemsFilter {
    /// 仅返回指定状态的项目（None 表示全部）
    pub status: Option<String>,
    /// 仅返回指定父任务的子任务（None 表示顶级任务）
    pub parent_id: Option<i64>,
    /// 截止日期上限（含），格式 "YYYY-MM-DD"
    pub due_date_before: Option<String>,
    /// 是否包含子任务（默认 true）
    pub include_children: Option<bool>,
}

/// 状态变更历史记录
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatusHistoryEntry {
    pub id: i64,
    pub item_id: i64,
    pub old_status: Option<String>,
    pub new_status: String,
    pub changed_at: String,
}
