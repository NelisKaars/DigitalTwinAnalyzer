#!/usr/bin/env python3
"""
Enhanced Integration Analysis - Qualitative Assessment
Analyzes setup procedures, documentation requirements, and integration patterns
"""

import re
from pathlib import Path

def analyze_setup_procedures():
    """Analyze framework setup and initialization complexity"""
    
    frameworks = ['threejs', 'babylonjs', 'playcanvas']
    setup_analysis = {}
    
    for framework in frameworks:
        visualizer_path = Path(f'../frameworks/{framework}/visualizer.js')
        
        if visualizer_path.exists():
            with open(visualizer_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Find initialization method
                init_match = re.search(r'initialize\([^)]*\)\s*{(.*?)}\s*(?=\n\s*[a-zA-Z])', content, re.DOTALL)
                
                if init_match:
                    init_code = init_match.group(1)
                    
                    setup_complexity = {
                        'init_lines': len(init_code.split('\n')),
                        'canvas_creation': 'createElement' in init_code,
                        'engine_setup': any(word in init_code.lower() for word in ['engine', 'app', 'renderer']),
                        'scene_setup': 'scene' in init_code.lower(),
                        'camera_setup': 'camera' in init_code.lower(),
                        'event_listeners': 'addEventListener' in init_code,
                        'error_handling_init': 'try' in init_code or 'catch' in init_code,
                        'async_operations': 'await' in init_code or 'then' in init_code,
                        'framework_specific_setup': count_framework_specific_setup(init_code, framework)
                    }
                    
                    setup_analysis[framework] = setup_complexity
    
    return setup_analysis

def count_framework_specific_setup(init_code, framework):
    """Count framework-specific setup operations"""
    patterns = {
        'threejs': ['THREE.', 'WebGLRenderer', 'PerspectiveCamera', 'OrbitControls'],
        'babylonjs': ['BABYLON.', 'Engine', 'createScene', 'FreeCamera'],
        'playcanvas': ['pc.', 'Application', 'setCanvasFillMode', 'FILLMODE_']
    }
    
    count = 0
    for pattern in patterns.get(framework, []):
        count += init_code.count(pattern)
    
    return count

def analyze_integration_patterns():
    """Analyze integration patterns and architectural decisions"""
    
    # Analyze common.js integration
    with open('js/common.js', 'r', encoding='utf-8') as f:
        common_content = f.read()
    
    with open('js/dashboard.js', 'r', encoding='utf-8') as f:
        dashboard_content = f.read()
    
    integration_patterns = {
        'api_abstraction': {
            'ditto_api_centralized': 'DittoAPI' in common_content,
            'framework_registry': 'VisualizationFrameworks' in dashboard_content,
            'dynamic_loading': 'loadFramework' in dashboard_content,
            'error_recovery': dashboard_content.count('catch') + common_content.count('catch')
        },
        'shared_components': {
            'tag_manager': 'TagManager' in common_content,
            'metrics_collection': 'MetricsCollector' in dashboard_content,
            'model_loader': 'FactoryModelLoader' in common_content,
            'visualization_components': 'VisualizationComponents' in common_content
        },
        'communication_patterns': {
            'websocket_support': 'WebSocket' in common_content,
            'polling_mechanism': 'polling' in common_content.lower(),
            'event_driven': 'addEventListener' in dashboard_content,
            'state_management': 'state' in common_content.lower()
        }
    }
    
    return integration_patterns

def analyze_maintenance_requirements():
    """Analyze code maintainability and future extensibility"""
    
    frameworks = ['threejs', 'babylonjs', 'playcanvas']
    maintenance_analysis = {}
    
    for framework in frameworks:
        visualizer_path = Path(f'frameworks/{framework}/visualizer.js')
        
        if visualizer_path.exists():
            with open(visualizer_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                maintenance_metrics = {
                    'documentation_comments': len(re.findall(r'/\*\*.*?\*/', content, re.DOTALL)),
                    'inline_comments': len(re.findall(r'//.*', content)),
                    'todo_fixme_count': len(re.findall(r'(TODO|FIXME|HACK)', content, re.IGNORECASE)),
                    'magic_numbers': len(re.findall(r'\b\d+\.?\d*\b', content)) - len(re.findall(r'\b[01]\b', content)),
                    'hardcoded_strings': len(re.findall(r'"[^"]{10,}"', content)),
                    'complex_functions': count_complex_functions(content),
                    'coupling_indicators': count_coupling_indicators(content),
                    'extensibility_patterns': count_extensibility_patterns(content)
                }
                
                maintenance_analysis[framework] = maintenance_metrics
    
    return maintenance_analysis

def count_complex_functions(content):
    """Count functions with high cyclomatic complexity"""
    functions = re.findall(r'function\s+\w+[^{]*{([^}]*(?:{[^}]*}[^}]*)*)}', content)
    complex_count = 0
    
    for func_body in functions:
        # Simple complexity estimate based on control flow statements
        complexity_indicators = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch']
        complexity = sum(func_body.count(indicator) for indicator in complexity_indicators)
        if complexity > 5:  # Arbitrary threshold
            complex_count += 1
    
    return complex_count

def count_coupling_indicators(content):
    """Count indicators of tight coupling"""
    coupling_patterns = [
        r'\.style\.',  # Direct DOM manipulation
        r'document\.',  # Direct document access
        r'window\.',   # Global window access
        r'console\.',  # Console usage (debugging artifacts)
    ]
    
    count = 0
    for pattern in coupling_patterns:
        count += len(re.findall(pattern, content))
    
    return count

def count_extensibility_patterns(content):
    """Count patterns that support extensibility"""
    extensibility_patterns = [
        r'interface\s+\w+',  # Interface definitions
        r'extends\s+\w+',    # Class inheritance
        r'callback',         # Callback patterns
        r'event',           # Event-driven patterns
        r'plugin',          # Plugin patterns
    ]
    
    count = 0
    for pattern in extensibility_patterns:
        count += len(re.findall(pattern, content, re.IGNORECASE))
    
    return count

def generate_qualitative_report():
    """Generate qualitative integration analysis report"""
    
    print("=== QUALITATIVE INTEGRATION ANALYSIS ===\n")
    
    # 1. Setup Procedure Analysis
    setup_analysis = analyze_setup_procedures()
    
    print("1. SETUP PROCEDURE COMPLEXITY")
    print("=" * 50)
    
    for framework, metrics in setup_analysis.items():
        print(f"\n{framework.upper()}:")
        print(f"  - Initialization lines: {metrics['init_lines']}")
        print(f"  - Canvas creation required: {metrics['canvas_creation']}")
        print(f"  - Engine/renderer setup: {metrics['engine_setup']}")
        print(f"  - Async operations in init: {metrics['async_operations']}")
        print(f"  - Framework-specific calls: {metrics['framework_specific_setup']}")
        print(f"  - Error handling in init: {metrics['error_handling_init']}")
    
    # 2. Integration Architecture
    integration_patterns = analyze_integration_patterns()
    
    print(f"\n2. INTEGRATION ARCHITECTURE PATTERNS")
    print("=" * 50)
    
    for category, patterns in integration_patterns.items():
        print(f"\n{category.replace('_', ' ').title()}:")
        for pattern, present in patterns.items():
            status = "✓" if present else "✗"
            if isinstance(present, int):
                print(f"  {status} {pattern.replace('_', ' ').title()}: {present}")
            else:
                print(f"  {status} {pattern.replace('_', ' ').title()}")
    
    # 3. Maintenance Requirements
    maintenance_analysis = analyze_maintenance_requirements()
    
    print(f"\n3. CODE MAINTAINABILITY ASSESSMENT")
    print("=" * 50)
    
    for framework, metrics in maintenance_analysis.items():
        print(f"\n{framework.upper()}:")
        print(f"  - Documentation blocks: {metrics['documentation_comments']}")
        print(f"  - Inline comments: {metrics['inline_comments']}")
        print(f"  - Technical debt indicators: {metrics['todo_fixme_count']}")
        print(f"  - Complex functions: {metrics['complex_functions']}")
        print(f"  - Coupling indicators: {metrics['coupling_indicators']}")
        print(f"  - Extensibility patterns: {metrics['extensibility_patterns']}")
    
    # 4. Summary Assessment
    print(f"\n4. INTEGRATION QUALITY ASSESSMENT")
    print("=" * 50)
    
    # Find min/max values for normalization
    all_frameworks = ['threejs', 'babylonjs', 'playcanvas']
    
    init_lines = [setup_analysis[fw]['init_lines'] for fw in all_frameworks]
    coupling_counts = [maintenance_analysis[fw]['coupling_indicators'] for fw in all_frameworks]
    doc_counts = [maintenance_analysis[fw]['documentation_comments'] for fw in all_frameworks]
    
    # Normalize scores to 0-10 scale
    def normalize_score(value, min_val, max_val, reverse=False):
        if max_val == min_val:
            return 5.0  # Default middle score if all values are the same
        normalized = (value - min_val) / (max_val - min_val) * 10
        return 10 - normalized if reverse else normalized
    
    for framework in all_frameworks:
        # Setup complexity: higher lines = higher complexity (0-10, higher is worse)
        setup_complexity = normalize_score(
            setup_analysis[framework]['init_lines'], 
            min(init_lines), max(init_lines)
        )
        
        # Coupling: higher coupling = worse maintainability (0-10, higher is worse)
        coupling_level = normalize_score(
            maintenance_analysis[framework]['coupling_indicators'],
            min(coupling_counts), max(coupling_counts)
        )
        
        # Documentation: more docs = better (0-10, higher is better, so we reverse)
        documentation_quality = normalize_score(
            maintenance_analysis[framework]['documentation_comments'],
            min(doc_counts), max(doc_counts), reverse=True
        )
        
        # Overall integration difficulty (0-30, lower is better)
        overall_difficulty = setup_complexity + coupling_level + documentation_quality
        
        print(f"\n{framework.upper()}:")
        print(f"  - Setup Complexity: {setup_complexity:.1f}/10 (lower is better)")
        print(f"  - Coupling Level: {coupling_level:.1f}/10 (lower is better)")
        print(f"  - Documentation Quality: {documentation_quality:.1f}/10 (lower is better)")
        print(f"  - Overall Integration Difficulty: {overall_difficulty:.1f}/30 (lower is better)")
        
        # Qualitative assessment based on properly normalized scores
        if overall_difficulty < 10:
            assessment = "Low difficulty - Easy to integrate and maintain"
        elif overall_difficulty < 20:
            assessment = "Medium difficulty - Moderate integration effort"
        else:
            assessment = "High difficulty - Significant integration overhead"
        
        print(f"  - Assessment: {assessment}")
        
        # Additional context
        print(f"  - Raw metrics: {setup_analysis[framework]['init_lines']} init lines, "
              f"{maintenance_analysis[framework]['coupling_indicators']} coupling points, "
              f"{maintenance_analysis[framework]['documentation_comments']} doc blocks")

if __name__ == '__main__':
    generate_qualitative_report()
