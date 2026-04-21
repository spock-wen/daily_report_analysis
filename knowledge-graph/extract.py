#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PATH = Path("/workspace/wiki")
DOMAINS_PATH = WIKI_PATH / "domains"
PROJECTS_PATH = WIKI_PATH / "projects"
OUTPUT_PATH = Path("/workspace/knowledge-graph")
OUTPUT_PATH.mkdir(exist_ok=True)

# 数据结构
knowledge_graph = {
    "nodes": [],
    "links": []
}

# 实体ID映射
entity_ids = {}
next_id = 1

# 辅助函数：生成唯一ID
def get_entity_id(type_, name):
    global next_id
    key = f"{type_}:{name}"
    if key not in entity_ids:
        entity_ids[key] = next_id
        next_id += 1
    return entity_ids[key]

# 解析领域文件
def parse_domain_file(domain_file):
    domain_name = domain_file.stem
    domain_id = get_entity_id("domain", domain_name)
    
    # 添加领域节点
    knowledge_graph["nodes"].append({
        "id": domain_id,
        "label": domain_name,
        "type": "domain",
        "properties": {
            "name": domain_name
        }
    })
    
    # 读取文件内容
    content = domain_file.read_text(encoding="utf-8")
    
    # 提取项目信息
    project_pattern = r"\[([^\]]+)\]\(\.\.\/\.\.\/wiki\/projects\/([^\)]+)\.md\)"
    matches = re.findall(project_pattern, content)
    
    for project_name, project_file in matches:
        project_id = get_entity_id("project", project_file)
        
        # 添加项目-领域关系
        knowledge_graph["links"].append({
            "source": project_id,
            "target": domain_id,
            "type": "belongs_to"
        })

# 解析项目文件
def parse_project_file(project_file):
    project_name = project_file.stem
    project_id = get_entity_id("project", project_name)
    
    # 读取文件内容
    content = project_file.read_text(encoding="utf-8")
    
    # 提取基本信息
    language_match = re.search(r"- 语言：([^\n]+)", content)
    domains_match = re.search(r"- 领域分类：([^\n]+)", content)
    stars_match = re.search(r"- GitHub Stars: ([^\n]+)", content)
    first_seen_match = re.search(r"- 首次上榜：([^\n]+)", content)
    last_seen_match = re.search(r"- 最近上榜：([^\n]+)", content)
    appearances_match = re.search(r"- 上榜次数：([^\n]+)", content)
    
    # 提取语言
    if language_match:
        language = language_match.group(1).strip()
        language_id = get_entity_id("language", language)
        
        # 添加语言节点
        if not any(node["id"] == language_id for node in knowledge_graph["nodes"]):
            knowledge_graph["nodes"].append({
                "id": language_id,
                "label": language,
                "type": "language",
                "properties": {
                    "name": language
                }
            })
        
        # 添加项目-语言关系
        knowledge_graph["links"].append({
            "source": project_id,
            "target": language_id,
            "type": "uses"
        })
    
    # 提取领域
    if domains_match:
        domains = domains_match.group(1).strip().split(", ")
        for domain in domains:
            domain_id = get_entity_id("domain", domain)
            
            # 添加领域节点
            if not any(node["id"] == domain_id for node in knowledge_graph["nodes"]):
                knowledge_graph["nodes"].append({
                    "id": domain_id,
                    "label": domain,
                    "type": "domain",
                    "properties": {
                        "name": domain
                    }
                })
            
            # 添加项目-领域关系
            knowledge_graph["links"].append({
                "source": project_id,
                "target": domain_id,
                "type": "belongs_to"
            })
    
    # 提取报告引用
    report_pattern = r"\[日报 ([^\]]+)\]\(\.\.\/\.\.\/reports\/daily\/([^\)]+)\.html\)"
    report_matches = re.findall(report_pattern, content)
    
    for report_date, report_file in report_matches:
        report_id = get_entity_id("report", report_file)
        
        # 添加报告节点
        if not any(node["id"] == report_id for node in knowledge_graph["nodes"]):
            knowledge_graph["nodes"].append({
                "id": report_id,
                "label": report_date,
                "type": "report",
                "properties": {
                    "name": report_date,
                    "date": report_date,
                    "type": "daily"
                }
            })
        
        # 添加项目-报告关系
        knowledge_graph["links"].append({
            "source": project_id,
            "target": report_id,
            "type": "mentioned_in"
        })
    
    # 添加项目节点
    project_properties = {
        "name": project_name
    }
    
    if stars_match:
        project_properties["stars"] = stars_match.group(1).strip()
    if first_seen_match:
        project_properties["first_seen"] = first_seen_match.group(1).strip()
    if last_seen_match:
        project_properties["last_seen"] = last_seen_match.group(1).strip()
    if appearances_match:
        project_properties["appearances"] = appearances_match.group(1).strip()
    
    knowledge_graph["nodes"].append({
        "id": project_id,
        "label": project_name,
        "type": "project",
        "properties": project_properties
    })

# 主函数
def main():
    # 解析所有领域文件
    for domain_file in DOMAINS_PATH.glob("*.md"):
        if domain_file.name == ".gitkeep":
            continue
        parse_domain_file(domain_file)
    
    # 解析所有项目文件
    for project_file in PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        parse_project_file(project_file)
    
    # 保存结果
    output_file = OUTPUT_PATH / "graph-data.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(knowledge_graph, f, ensure_ascii=False, indent=2)
    
    print(f"知识图谱数据提取完成，保存到: {output_file}")
    print(f"节点数量: {len(knowledge_graph['nodes'])}")
    print(f"关系数量: {len(knowledge_graph['links'])}")

if __name__ == "__main__":
    main()
