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
        // [dimension1_normalized, dimension2_normalized, ...]
        var dimensionNamesNormalized = config.dimensions.map(function(d) {
            return d + normalizeSuffix;
        });

        // 각도 설정 thetaScale(0~) => 파라미터가 커질수록 각도도 커지는듯
        // dimensions 수 만큼 각도를 설정한다.
        var thetaScale = d3.scale.linear().domain([0, dimensionNamesNormalized.length]).range([0, Math.PI * 2]);
        // 총 테두리 반지름
        var chartRadius = config.size / 2 - config.margin;
        // 데이터 갯수
        var nodeCount = data.length;
        // 총 테두리 지름
        var panelSize = config.size - config.margin * 2;

        // dimension들의 노드화 [{...}, {...}, ...]
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

        const linksData = []; // [{...}, {...}, ...]
        data.forEach(function(d, i) {
            dimensionNamesNormalized.forEach(function(dB, iB) {
                // console.log(i);
                // console.log('nodeCount', nodeCount);
                // console.log(iB);
                // console.log('d : ', d);
                // console.log('dB : ', dB);
                linksData.push({
                    source: i, // 숫자 0~149
                    target: nodeCount + iB, // 숫자 150 + 0~3
                    value: d[dB] // data 객체에 속성 dimension1_normalized
                });
            });
        });
        // console.log(linksData[0]);

        force.size([panelSize, panelSize])
            .linkStrength(function(d) {
                return d.value;
            })
            .nodes(data.concat(dimensionNodes))
            .links(linksData)
            .start();

        // Basic structure  SVG 그리기
        var svg = d3.select(config.el)
            .append('svg')
            .attr({
                width: config.size,
                height: config.size
            });
        // background 큰 배경 그리기
        svg.append('rect')
            .classed('bg', true)
            .attr({
                width: config.size,
                height: config.size
            });
        // margin을 제외한 곳에 네모 g 그리기
        var root = svg.append('g')
            .attr({
                transform: 'translate(' + [config.margin, config.margin] + ')'
            });
        // g에다 큰 테두리 원 그리기
        var panel = root.append('circle')
            .classed('panel', true)
            .attr({
                r: chartRadius,
                cx: chartRadius,
                cy: chartRadius
            });

        // 확장시키고 싶을 때
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

        // Links. 노드와 dimensions 의 선을 그린다면
        if(config.drawLinks) {
            var links = root.selectAll('.link')
                .data(linksData)
                .enter().append('line')
                .classed('link', true);
        }

        // Nodes. data 노드그리기
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
            .on('mouseenter', function(d) { // 노드에 마우스 진입시 툴팁보이기
                if(config.useTooltip) {
                    var mouse = d3.mouse(config.el);
                    tooltip.setText(config.tooltipFormatter(d)).setPosition(mouse[0], mouse[1]).show();
                }
                events.dotEnter(d);
                this.classList.add('active');
            })
            .on('mouseout', function(d) { // 노드에 마우스 나갈시 툴팁사라지기
                if(config.useTooltip) {
                    tooltip.hide();
                }
                events.dotLeave(d);
                this.classList.remove('active');
            });

        // Labels. 테두리의 dimensions 노드들 그리기
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
        // dimensions 노드들의 텍스트 그리기
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

        // Update force. tick event 일때마다 인듯
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
            // 노드의 위치를 그린다.
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
        // (dimension)_normalized 속성을
        data.forEach(function(d) {
            config.dimensions.forEach(function(dimension) {
                d[dimension + '_normalized'] = normalizationScales[dimension](d[dimension]);
            });
        });

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
