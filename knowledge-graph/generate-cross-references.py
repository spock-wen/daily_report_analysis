#!/usr/bin/env python#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

##!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects =#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"-#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        ##!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content,#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content, re.DOTALL)
        if core_#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content, re.DOTALL)
        if core_functions_match:
            functions_text = core_#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content, re.DOTALL)
        if core_functions_match:
            functions_text = core_functions_match.group(1)
            for line in functions_text.split("- "):
                if line.strip():
                    core#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content, re.DOTALL)
        if core_functions_match:
            functions_text = core_functions_match.group(1)
            for line in functions_text.split("- "):
                if line.strip():
                    core_functions.append(line.strip())
        
        # 提取版本历史中的分析内容#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content, re.DOTALL)
        if core_functions_match:
            functions_text = core_functions_match.group(1)
            for line in functions_text.split("- "):
                if line.strip():
                    core_functions.append(line.strip())
        
        # 提取版本历史中的分析内容
        analysis_content = []
        analysis#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content, re.DOTALL)
        if core_functions_match:
            functions_text = core_functions_match.group(1)
            for line in functions_text.split("- "):
                if line.strip():
                    core_functions.append(line.strip())
        
        # 提取版本历史中的分析内容
        analysis_content = []
        analysis_matches = re.findall(r"\*\*分析\*\*: (.*#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

# 定义路径
WIKI_PROJECTS_PATH = Path("/workspace/wiki/projects")

# 加载项目数据
def load_projects():
    projects = []
    for project_file in WIKI_PROJECTS_PATH.glob("*.md"):
        if project_file.name == ".gitkeep":
            continue
        
        content = project_file.read_text(encoding="utf-8")
        
        # 提取项目名称
        project_name = project_file.stem
        
        # 提取基本信息
        language_match = re.search(r"- 语言：([^\n]+)", content)
        domains_match = re.search(r"- 领域分类：([^\n]+)", content)
        
        # 提取核心功能
        core_functions = []
        core_functions_match = re.search(r"## 核心功能\n(.*?)\n\n##", content, re.DOTALL)
        if core_functions_match:
            functions_text = core_functions_match.group(1)
            for line in functions_text.split("- "):
                if line.strip():
                    core_functions.append(line.strip())
        
        # 提取版本历史中的分析内容
        analysis_content = []
        analysis_matches = re.findall(r"\*\*分析\*\*: (.*?)(?:\n|$)", content