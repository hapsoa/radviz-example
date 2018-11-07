var radvizComponent = function() {
  // default 설정 값
  var config = {
        el: null, // html 의 class 나 id
        size: 400, // radviz 테두리의 지름
        margin: 50, // radviz 테두리밖의 margin
        colorScale: d3.scale.ordinal().range(['skyblue', 'orange', 'lime']), // 색상 종류. color palete
        colorAccessor: null,
        dimensions: [], // multivariate variable
        drawLinks: true, // 각 노드들이 dimension과 연결되어 있는 선
        zoomFactor: 1,
        dotRadius: 6, // node radius
        useRepulsion: false,
        useTooltip: true, // node hover시 툴팁을 사용하느냐
        tooltipFormatter: function(d) { // 툴팁을 어떻게 표시할거냐
            return d;
        }
    };

    // 이벤트 종류를 만들어 events에 모아운다.
    var events = d3.dispatch('panelEnter', 'panelLeave', 'dotEnter', 'dotLeave');

    var force = d3.layout.force()
        .chargeDistance(0)
        .charge(-60)
        .friction(0.5);

    var render = function(data) {
        data = addNormalizedValues(data);
        var normalizeSuffix = '_normalized';
        var dimensionNamesNormalized = config.dimensions.map(function(d) {
            return d + normalizeSuffix;
        });
        var thetaScale = d3.scale.linear().domain([0, dimensionNamesNormalized.length]).range([0, Math.PI * 2]);

        var chartRadius = config.size / 2 - config.margin;
        var nodeCount = data.length;
        var panelSize = config.size - config.margin * 2;

        var dimensionNodes = config.dimensions.map(function(d, i) {
            var angle = thetaScale(i);
            var x = chartRadius + Math.cos(angle) * chartRadius * config.zoomFactor;
            var y = chartRadius + Math.sin(angle) * chartRadius * config.zoomFactor;
            return {
                index: nodeCount + i,
                x: x,
                y: y,
                fixed: true,
                name: d
            };
        });

        var linksData = [];
        data.forEach(function(d, i) {
            dimensionNamesNormalized.forEach(function(dB, iB) {
                linksData.push({
                    source: i,
                    target: nodeCount + iB,
                    value: d[dB]
                });
            });
        });

        force.size([panelSize, panelSize])
            .linkStrength(function(d) {
                return d.value;
            })
            .nodes(data.concat(dimensionNodes))
            .links(linksData)
            .start();

        // Basic structure
        var svg = d3.select(config.el)
            .append('svg')
            .attr({
                width: config.size,
                height: config.size
            });

        svg.append('rect')
            .classed('bg', true)
            .attr({
                width: config.size,
                height: config.size
            });

        var root = svg.append('g')
            .attr({
                transform: 'translate(' + [config.margin, config.margin] + ')'
            });

        var panel = root.append('circle')
            .classed('panel', true)
            .attr({
                r: chartRadius,
                cx: chartRadius,
                cy: chartRadius
            });

        if(config.useRepulsion) {
            root.on('mouseenter', function(d) {
                force.chargeDistance(80).alpha(0.2);
                events.panelEnter();
            });
            root.on('mouseleave', function(d) {
                force.chargeDistance(0).resume();
                events.panelLeave();
            });
        }

        // Links
        if(config.drawLinks) {
            var links = root.selectAll('.link')
                .data(linksData)
                .enter().append('line')
                .classed('link', true);
        }

        // Nodes
        var nodes = root.selectAll('circle.dot')
            .data(data)
            .enter().append('circle')
            .classed('dot', true)
            .attr({
                r: config.dotRadius,
                fill: function(d) {
                    return config.colorScale(config.colorAccessor(d));
                }
            })
            .on('mouseenter', function(d) {
                if(config.useTooltip) {
                    var mouse = d3.mouse(config.el);
                    tooltip.setText(config.tooltipFormatter(d)).setPosition(mouse[0], mouse[1]).show();
                }
                events.dotEnter(d);
                this.classList.add('active');
            })
            .on('mouseout', function(d) {
                if(config.useTooltip) {
                    tooltip.hide();
                }
                events.dotLeave(d);
                this.classList.remove('active');
            });

        // Labels
        var labelNodes = root.selectAll('circle.label-node')
            .data(dimensionNodes)
            .enter().append('circle')
            .classed('label-node', true)
            .attr({
                cx: function(d) {
                    return d.x;
                },
                cy: function(d) {
                    return d.y;
                },
                r: 4
            });

        var labels = root.selectAll('text.label')
            .data(dimensionNodes)
            .enter().append('text')
            .classed('label', true)
            .attr({
                x: function(d) {
                    return d.x;
                },
                y: function(d) {
                    return d.y;
                },
                'text-anchor': function(d) {
                    if(d.x > (panelSize * 0.4) && d.x < (panelSize * 0.6)) {
                        return 'middle';
                    } else {
                        return(d.x > panelSize / 2) ? 'start' : 'end';
                    }
                },
                'dominant-baseline': function(d) {
                    return(d.y > panelSize * 0.6) ? 'hanging' : 'auto';
                },
                dx: function(d) {
                    return(d.x > panelSize / 2) ? '6px' : '-6px';
                },
                dy: function(d) {
                    return(d.y > panelSize * 0.6) ? '6px' : '-6px';
                }
            })
            .text(function(d) {
                return d.name;
            });

        // Update force
        force.on('tick', function() {
            if(config.drawLinks) {
                links.attr({
                    x1: function(d) {
                        return d.source.x;
                    },
                    y1: function(d) {
                        return d.source.y;
                    },
                    x2: function(d) {
                        return d.target.x;
                    },
                    y2: function(d) {
                        return d.target.y;
                    }
                });
            }

            nodes.attr({
                cx: function(d) {
                    return d.x;
                },
                cy: function(d) {
                    return d.y;
                }
            });
        });

        var tooltipContainer = d3.select(config.el)
            .append('div')
            .attr({
                id: 'radviz-tooltip'
            });
        var tooltip = tooltipComponent(tooltipContainer.node());

        return this;
    };

  /**
   * config 객체를 넣은다음, 기존의 default config에 변경된 사항들을 넣는다.
   * @param _config 외부의 config 객체
   * @returns {this} 전체 객체 자신을 리턴한다.
   */
    var setConfig = function(_config) {
        config = utils.mergeAll(config, _config);
        return this;
    };

    // (예상) 0과 1사이로 값을 정규화 시키는 코드
    var addNormalizedValues = function(data) {
        // 의미가 없는 코드인데, 숫자로 바꿔주나?
        data.forEach(function(d) {
            config.dimensions.forEach(function(dimension) {
                d[dimension] = +d[dimension];
            });
        });

        var normalizationScales = {};
        config.dimensions.forEach(function(dimension) {
            normalizationScales[dimension] = d3.scale.linear().domain(d3.extent(data.map(function(d, i) {
                return d[dimension];
            }))).range([0, 1]);
        });

        data.forEach(function(d) {
            config.dimensions.forEach(function(dimension) {
                d[dimension + '_normalized'] = normalizationScales[dimension](d[dimension]);
            });
        });
        console.log(data);

        return data;
    };

    // radviz 변수가 사용할 수 있는 함수 2개
    var exports = {
        config: setConfig,
        render: render
    };

    // 이벤트 함수 on 을 바인딩 해놓는 것
    d3.rebind(exports, events, 'on');

    return exports;
};
