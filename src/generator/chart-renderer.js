/**
 * 图表渲染器
 * 使用 Chart.js 渲染月度报告图表
 *
 * 依赖：Chart.js (CDN 引入)
 * 文件：src/generator/chart-renderer.js
 */

class ChartRenderer {
  /**
   * 渲染饼图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据 { labels: [], values: [] }
   * @param {Object} options - 配置选项
   */
  renderPieChart(canvasId, data, options = {}) {
    return `
      <canvas id="${canvasId}"></canvas>
      <script>
        (function() {
          const ctx = document.getElementById('${canvasId}');
          if (!ctx) return;

          new Chart(ctx, {
            type: 'pie',
            data: {
              labels: ${JSON.stringify(data.labels || [])},
              datasets: [{
                data: ${JSON.stringify(data.values || [])},
                backgroundColor: ${JSON.stringify(options.colors || this.getDefaultColors())},
                borderWidth: 2,
                borderColor: '#fff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: '${options.legendPosition || 'bottom'}',
                  labels: {
                    padding: 15,
                    font: { size: 12 }
                  }
                },
                title: {
                  display: ${options.title ? 'true' : 'false'},
                  text: '${options.title || ''}',
                  font: { size: 16, weight: 'bold' }
                }
              }
            }
          });
        })();
      </script>
    `;
  }

  /**
   * 渲染柱状图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据 { labels: [], values: [] }
   * @param {Object} options - 配置选项
   */
  renderBarChart(canvasId, data, options = {}) {
    return `
      <canvas id="${canvasId}"></canvas>
      <script>
        (function() {
          const ctx = document.getElementById('${canvasId}');
          if (!ctx) return;

          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(data.labels || [])},
              datasets: [{
                label: '${options.label || '项目数量'}',
                data: ${JSON.stringify(data.values || [])},
                backgroundColor: ${JSON.stringify(options.colors || this.getDefaultColors())},
                borderWidth: 1,
                borderRadius: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: ${options.showLegend ? 'true' : 'false'}
                },
                title: {
                  display: ${options.title ? 'true' : 'false'},
                  text: '${options.title || ''}',
                  font: { size: 16, weight: 'bold' }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1
                  }
                },
                x: {
                  ticks: {
                    maxRotation: 45,
                    minRotation: 45
                  }
                }
              }
            }
          });
        })();
      </script>
    `;
  }

  /**
   * 渲染趋势线图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据 { labels: [], datasets: [{ label, data, borderColor }] }
   * @param {Object} options - 配置选项
   */
  renderTrendLineChart(canvasId, data, options = {}) {
    const datasets = data.datasets || [];

    return `
      <canvas id="${canvasId}"></canvas>
      <script>
        (function() {
          const ctx = document.getElementById('${canvasId}');
          if (!ctx) return;

          new Chart(ctx, {
            type: 'line',
            data: {
              labels: ${JSON.stringify(data.labels || [])},
              datasets: ${JSON.stringify(datasets.map(ds => ({
                label: ds.label,
                data: ds.data,
                borderColor: ds.borderColor || '#667eea',
                backgroundColor: ds.backgroundColor || 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: ds.fill !== false
              })), null, 2)}
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: '${options.legendPosition || 'top'}',
                  labels: {
                    padding: 15,
                    font: { size: 12 }
                  }
                },
                title: {
                  display: ${options.title ? 'true' : 'false'},
                  text: '${options.title || ''}',
                  font: { size: 16, weight: 'bold' }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: '${options.yLabel || '项目数量'}'
                  }
                },
                x: {
                  title: {
                    display: true,
                    text: '${options.xLabel || '时间'}'
                  }
                }
              }
            }
          });
        })();
      </script>
    `;
  }

  /**
   * 渲染雷达图（用于新兴领域展示）
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据 { labels: [], values: [] }
   * @param {Object} options - 配置选项
   */
  renderRadarChart(canvasId, data, options = {}) {
    return `
      <canvas id="${canvasId}"></canvas>
      <script>
        (function() {
          const ctx = document.getElementById('${canvasId}');
          if (!ctx) return;

          new Chart(ctx, {
            type: 'radar',
            data: {
              labels: ${JSON.stringify(data.labels || [])},
              datasets: [{
                label: '${options.label || '领域热度'}',
                data: ${JSON.stringify(data.values || [])},
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointRadius: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: ${options.showLegend ? 'true' : 'false'}
                },
                title: {
                  display: ${options.title ? 'true' : 'false'},
                  text: '${options.title || ''}',
                  font: { size: 16, weight: 'bold' }
                }
              },
              scales: {
                r: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1,
                    backdropColor: 'transparent'
                  },
                  grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                  }
                }
              }
            }
          });
        })();
      </script>
    `;
  }

  /**
   * 获取默认颜色集
   */
  getDefaultColors() {
    return [
      'rgba(102, 126, 234, 0.8)',
      'rgba(118, 75, 162, 0.8)',
      'rgba(240, 147, 251, 0.8)',
      'rgba(245, 175, 255, 0.8)',
      'rgba(147, 197, 253, 0.8)',
      'rgba(111, 207, 151, 0.8)',
      'rgba(134, 239, 172, 0.8)',
      'rgba(253, 224, 71, 0.8)',
      'rgba(251, 191, 36, 0.8)',
      'rgba(251, 146, 60, 0.8)'
    ];
  }

  /**
   * 生成图表容器 HTML
   * @param {string} id - 容器 ID
   * @param {string} title - 图表标题
   * @param {string} height - 容器高度（默认 300px）
   */
  generateChartContainer(id, title, height = '300px') {
    return `
      <div class="chart-container" style="height: ${height};">
        <h4 class="chart-title">${title}</h4>
        <canvas id="${id}"></canvas>
      </div>
    `;
  }
}

module.exports = ChartRenderer;
