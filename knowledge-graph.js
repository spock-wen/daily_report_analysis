717:    // ========== 知识图谱可视化 ==========
718-    (function() {
719-      const graphContainer = document.getElementById('graphContainer');
720-      if (!graphContainer) return;
721-
722-      let svg, simulation, nodes, links, nodeElements, linkElements;
723-      let graphData = { nodes: [], links: [] };
724-
725-      // 加载数据
726-      fetch('../knowledge-graph/graph-data.json')
727-        .then(response => response.json())
728-        .then(data => {
729-          graphData = data;
730-          initializeGraph();
731-        })
732-        .catch(error => {
733-          console.error('Error loading graph data:', error);
734-          graphContainer.innerHTML = '<p style="color: #f85149; text-align: center; padding: 20px;">知识图谱数据加载失败</p>';
735-        });
736-
737-      // 初始化图谱
738-      function initializeGraph() {
739-        // 清空容器
740-        graphContainer.innerHTML = '';
741-
742-        // 创建SVG
743-        svg = d3.select('#graphContainer')
744-          .append('svg')
745-          .attr('width', '100%')
746-          .attr('height', '100%');
747-
748-        // 创建力导向模拟
749-        simulation = d3.forceSimulation(graphData.nodes)
750-          .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(100))
751-          .force('charge', d3.forceManyBody().strength(-300))
752-          .force('center', d3.forceCenter(graphContainer.clientWidth / 2, graphContainer.clientHeight / 2))
753-          .force('collision', d3.forceCollide().radius(d => getNodeRadius(d)));
754-
755-        // 创建连接线
756-        linkElements = svg.append('g')
757-          .selectAll('line')
758-          .data(graphData.links)
759-          .enter()
760-          .append('line')
761-          .attr('class', d => `link ${d.type}`)
762-          .attr('stroke-width', d => {
763-            switch(d.type) {
764-              case 'belongs_to': return 2;
765-              case 'contains': return 2;
766-              case 'uses': return 1;
767-              case 'mentioned_in': return 1;
768-              default: return 1;
769-            }
770-          });
771-
772-        // 创建节点
773-        nodeElements = svg.append('g')
774-          .selectAll('circle')
775-          .data(graphData.nodes)
776-          .enter()
777-          .append('circle')
778-          .attr('class', d => `node ${d.type}`)
779-          .attr('r', d => getNodeRadius(d))
780-          .call(d3.drag()
781-            .on('start', dragstarted)
782-            .on('drag', dragged)
783-            .on('end', dragended));
784-
785-        // 创建标签
786-        const labelElements = svg.append('g')
787-          .selectAll('text')
788-          .data(graphData.nodes)
789-          .enter()
790-          .append('text')
791-          .attr('class', 'node-label')
792-          .attr('font-size', '10px')
793-          .attr('dx', 12)
794-          .attr('dy', 4)
795-          .text(d => d.label)
796-          .style('fill', '#c9d1d9');
797-
798-        // 创建 tooltip
799-        const tooltip = d3.select('body')
800-          .append('div')
801-          .attr('class', 'tooltip')
802-          .style('opacity', 0);
803-
804-        // 节点交互
805-        nodeElements
806-          .on('mouseover', function(event, d) {
807-            tooltip.transition()
808-              .duration(200)
809-              .style('opacity', .9);
810-            
811-            let tooltipContent = `<strong>${d.label}</strong><br>类型: ${getTypeName(d.type)}<br>`;
812-            
813-            if (d.properties) {
814-              for (const [key, value] of Object.entries(d.properties)) {
815-                if (key !== 'name') {
816-                  tooltipContent += `${getPropertyName(key)}: ${value}<br>`;
817-                }
818-              }
819-            }
820-            
821-            tooltip.html(tooltipContent)
822-              .style('left', (event.pageX + 10) + 'px')
823-              .style('top', (event.pageY - 28) + 'px');
824-          })
825-          .on('mouseout', function() {
826-            tooltip.transition()
827-              .duration(500)
828-              .style('opacity', 0);
829-          });
830-
831-        // 模拟更新
832-        simulation.on('tick', () => {
833-          linkElements
834-            .attr('x1', d => d.source.x)
835-            .attr('y1', d => d.source.y)
836-            .attr('x2', d => d.target.x)
837-            .attr('y2', d => d.target.y);
838-
839-          nodeElements
840-            .attr('cx', d => d.x = Math.max(getNodeRadius(d), Math.min(graphContainer.clientWidth - getNodeRadius(d), d.x)))
841-            .attr('cy', d => d.y = Math.max(getNodeRadius(d), Math.min(graphContainer.clientHeight - getNodeRadius(d), d.y)));
842-
843-          labelElements
844-            .attr('x', d => d.x)
845-            .attr('y', d => d.y);
846-        });
847-
848-        // 控制按钮事件
849-        document.getElementById('resetGraph').addEventListener('click', resetGraph);
850-        document.getElementById('showProjects').addEventListener('click', () => filterNodes('project'));
851-        document.getElementById('showDomains').addEventListener('click', () => filterNodes('domain'));
852-        document.getElementById('showLanguages').addEventListener('click', () => filterNodes('language'));
853-      }
854-
855-      // 获取节点半径
856-      function getNodeRadius(d) {
857-        switch(d.type) {
858-          case 'domain': return 15;
859-          case 'report': return 12;
860-          case 'project': return 10;
861-          case 'language': return 8;
862-          default: return 8;
863-        }
864-      }
865-
866-      // 获取类型名称
867-      function getTypeName(type) {
868-        const typeNames = {
869-          'project': '项目',
870-          'domain': '领域',
871-          'language': '语言',
872-          'report': '报告'
873-        };
874-        return typeNames[type] || type;
875-      }
876-
877-      // 获取属性名称
878-      function getPropertyName(key) {
879-        const propertyNames = {
880-          'stars': 'Stars',
881-          'first_seen': '首次上榜',
882-          'last_seen': '最近上榜',
883-          'appearances': '上榜次数',
884-          'date': '日期',
885-          'type': '类型'
886-        };
887-        return propertyNames[key] || key;
888-      }
889-
890-      // 重置图谱
891-      function resetGraph() {
892-        nodeElements.style('opacity', 1);
893-        linkElements.style('opacity', 1);
894-        simulation.alpha(1).restart();
895-      }
896-
897-      // 筛选节点
898-      function filterNodes(type) {
899-        nodeElements.style('opacity', d => d.type === type ? 1 : 0.2);
900-        linkElements.style('opacity', d => {
901-          const sourceType = graphData.nodes.find(n => n.id === d.source.id || n.id === d.source).type;
902-          const targetType = graphData.nodes.find(n => n.id === d.target.id || n.id === d.target).type;
903-          return (sourceType === type || targetType === type) ? 0.6 : 0.1;
904-        });
905-      }
906-
907-      // 拖拽函数
908-      function dragstarted(event, d) {
909-        if (!event.active) simulation.alphaTarget(0.3).restart();
910-        d.fx = d.x;
911-        d.fy = d.y;
912-      }
913-
914-      function dragged(event, d) {
915-        d.fx = event.x;
916-        d.fy = event.y;
917-      }
918-
919-      function dragended(event, d) {
920-        if (!event.active) simulation.alphaTarget(0);
921-        d.fx = null;
922-        d.fy = null;
923-      }
924-
925-    })();
926-  </script>
927-</body>
928-</html>
