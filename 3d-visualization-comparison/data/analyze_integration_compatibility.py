#!/usr/bin/env python3
"""
Integration and Compatibility Analysis Script
Analyzes framework implementations for setup complexity, code maintainability, and ecosystem compatibility
"""

import os
import re
import json
from pathlib import Path
import matplotlib.pyplot as plt
import pandas as pd

def analyze_code_complexity():
    """Analyze code complexity metrics for each framework"""
    frameworks = ['threejs', 'babylonjs', 'playcanvas']
    results = {}
    
    for framework in frameworks:
        framework_path = Path(f'../frameworks/{framework}')
        
        # Count lines of code
        total_lines = 0
        files = []
        for js_file in framework_path.glob('*.js'):
            with open(js_file, 'r', encoding='utf-8') as f:
                lines = len(f.readlines())
                total_lines += lines
                files.append({'file': js_file.name, 'lines': lines})
        
        # Analyze main visualizer file
        visualizer_path = framework_path / 'visualizer.js'
        if visualizer_path.exists():
            with open(visualizer_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Count various complexity indicators
                complexity_metrics = {
                    'total_lines': total_lines,
                    'files_count': len(files),
                    'methods_count': len(re.findall(r'^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*{', content, re.MULTILINE)),
                    'classes_count': len(re.findall(r'class\s+\w+', content)),
                    'async_methods': len(re.findall(r'async\s+\w+', content)),
                    'error_handling': len(re.findall(r'catch\s*\(', content)),
                    'framework_specific_apis': count_framework_apis(content, framework),
                    'shared_api_usage': count_shared_apis(content),
                    'dependencies': count_external_dependencies(framework)
                }
                
                results[framework] = complexity_metrics
    
    return results

def count_framework_apis(content, framework):
    """Count framework-specific API calls"""
    patterns = {
        'threejs': [r'THREE\.', r'new\s+THREE', r'\.add\(', r'\.position\.', r'\.rotation\.'],
        'babylonjs': [r'BABYLON\.', r'new\s+BABYLON', r'\.createScene', r'\.createCamera', r'\.dispose\('],
        'playcanvas': [r'pc\.', r'new\s+pc\.', r'\.addComponent', r'\.setLocalPosition', r'\.app\.']
    }
    
    count = 0
    for pattern in patterns.get(framework, []):
        count += len(re.findall(pattern, content))
    
    return count

def count_shared_apis(content):
    """Count usage of shared/common APIs"""
    shared_patterns = [
        r'DittoAPI\.',
        r'VisualizationComponents\.',
        r'TagManager',
        r'MetricsCollector\.',
        r'FactoryModelLoader\.'
    ]
    
    count = 0
    for pattern in shared_patterns:
        count += len(re.findall(pattern, content))
    
    return count

def count_external_dependencies(framework):
    """Count external library dependencies"""
    # Parse dashboard.js to find framework libraries
    with open('js/dashboard.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
        # Extract frameworkLibraries object
        libraries_match = re.search(r"'{}'\s*:\s*\[(.*?)\]".format(framework), content, re.DOTALL)
        if libraries_match:
            libraries_text = libraries_match.group(1)
            # Count number of URLs/dependencies
            urls = re.findall(r"'https?://[^']+", libraries_text)
            return len(urls)
    
    return 0

def analyze_integration_patterns():
    """Analyze integration patterns and setup complexity"""
    
    # Analyze shared infrastructure usage
    shared_files = [
        'js/common.js',
        'js/visualization-components.js', 
        'js/tag-manager.js',
        'js/factory-model-loader.js'
    ]
    
    shared_complexity = {}
    for file_path in shared_files:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = len(content.split('\n'))
                    functions = len(re.findall(r'function\s+\w+', content))
                    classes = len(re.findall(r'class\s+\w+', content))
                    
                    shared_complexity[file_path] = {
                        'lines': lines,
                        'functions': functions,
                        'classes': classes
                    }
            except UnicodeDecodeError:
                print(f"Warning: Could not read {file_path} (binary file)")
                shared_complexity[file_path] = {
                    'lines': 0,
                    'functions': 0,
                    'classes': 0
                }
    
    return shared_complexity

def analyze_ecosystem_compatibility():
    """Analyze ecosystem and tooling compatibility"""
    
    # Check for build configurations
    build_configs = {}
    config_files = ['package.json', 'webpack.config.js', 'rollup.config.js', 'vite.config.js']
    
    for config_file in config_files:
        if os.path.exists(config_file):
            build_configs[config_file] = True
        else:
            build_configs[config_file] = False
    
    # Analyze HTML integration complexity
    with open('dashboard.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
        
        script_tags = len(re.findall(r'<script', html_content))
        external_scripts = len(re.findall(r'<script[^>]+src=', html_content))
        
    integration_complexity = {
        'build_configs': build_configs,
        'script_dependencies': script_tags,
        'external_dependencies': external_scripts,
        'dynamic_loading': 'loadFramework' in html_content
    }
    
    return integration_complexity

def generate_compatibility_report():
    """Generate comprehensive compatibility and integration report"""
    
    print("=== FRAMEWORK COMPATIBILITY AND INTEGRATION ANALYSIS ===\n")
    
    # 1. Code Complexity Analysis
    complexity_results = analyze_code_complexity()
    
    print("1. CODE COMPLEXITY AND MAINTAINABILITY")
    print("=" * 50)
    
    df_complexity = pd.DataFrame(complexity_results).T
    print(df_complexity.to_string())
    print()
    
    # 2. Integration Patterns
    shared_analysis = analyze_integration_patterns()
    
    print("2. SHARED INFRASTRUCTURE UTILIZATION")
    print("=" * 50)
    
    total_shared_lines = sum([info['lines'] for info in shared_analysis.values()])
    print(f"Total shared infrastructure: {total_shared_lines} lines of code")
    
    for file_path, metrics in shared_analysis.items():
        print(f"{file_path}: {metrics['lines']} lines, {metrics['functions']} functions, {metrics['classes']} classes")
    print()
    
    # 3. Setup and Integration Complexity
    ecosystem_analysis = analyze_ecosystem_compatibility()
    
    print("3. ECOSYSTEM COMPATIBILITY")
    print("=" * 50)
    
    for framework in ['threejs', 'babylonjs', 'playcanvas']:
        framework_lines = complexity_results[framework]['total_lines']
        shared_usage = complexity_results[framework]['shared_api_usage']
        framework_specific = complexity_results[framework]['framework_specific_apis']
        dependencies = complexity_results[framework]['dependencies']
        
        reusability_ratio = shared_usage / (shared_usage + framework_specific) if (shared_usage + framework_specific) > 0 else 0
        
        print(f"{framework.upper()}:")
        print(f"  - Implementation size: {framework_lines} lines")
        print(f"  - External dependencies: {dependencies}")
        print(f"  - Shared API usage: {shared_usage}")
        print(f"  - Framework-specific APIs: {framework_specific}")
        print(f"  - Code reusability ratio: {reusability_ratio:.2%}")
        print()
    
    # 4. Generate summary table
    print("4. INTEGRATION COMPLEXITY SUMMARY")
    print("=" * 50)
    
    summary_data = []
    for framework in ['threejs', 'babylonjs', 'playcanvas']:
        metrics = complexity_results[framework]
        
        # Calculate integration complexity score (lower is better)
        setup_score = metrics['dependencies'] * 2  # Each dependency adds complexity
        code_score = metrics['total_lines'] / 100  # Normalize lines of code
        maintainability_score = 10 - min(metrics['error_handling'], 10)  # Better error handling = lower score
        
        integration_score = setup_score + code_score + maintainability_score
        
        reusability_ratio = metrics['shared_api_usage'] / (metrics['shared_api_usage'] + metrics['framework_specific_apis']) if (metrics['shared_api_usage'] + metrics['framework_specific_apis']) > 0 else 0
        
        summary_data.append({
            'Framework': framework.capitalize(),
            'Lines_of_Code': metrics['total_lines'],
            'External_Dependencies': metrics['dependencies'],
            'Error_Handling_Points': metrics['error_handling'],
            'Code_Reusability_Ratio': f"{reusability_ratio:.2%}",
            'Integration_Complexity_Score': f"{integration_score:.1f}"
        })
    
    df_summary = pd.DataFrame(summary_data)
    print(df_summary.to_string(index=False))
    
    # Save results
    df_summary.to_csv('integration_compatibility_analysis.csv', index=False)
    
    print(f"\n5. ANALYSIS COMPLETE")
    print("=" * 50)
    print("Results saved to: integration_compatibility_analysis.csv")
    print("\nKey Findings:")
    print("- Lower Integration Complexity Score indicates easier integration")
    print("- Higher Code Reusability Ratio indicates better maintainability")
    print("- More Error Handling Points indicate better reliability")

def create_visualization():
    """Create visualizations for the compatibility analysis"""
    
    complexity_results = analyze_code_complexity()
    
    # Extract data for plotting
    frameworks = list(complexity_results.keys())
    
    # Prepare data
    lines_of_code = [complexity_results[fw]['total_lines'] for fw in frameworks]
    dependencies = [complexity_results[fw]['dependencies'] for fw in frameworks]
    shared_usage = [complexity_results[fw]['shared_api_usage'] for fw in frameworks]
    framework_specific = [complexity_results[fw]['framework_specific_apis'] for fw in frameworks]
    
    # Calculate reusability ratios
    reusability_ratios = []
    for i, fw in enumerate(frameworks):
        total_apis = shared_usage[i] + framework_specific[i]
        ratio = shared_usage[i] / total_apis if total_apis > 0 else 0
        reusability_ratios.append(ratio * 100)
    
    # Create subplots
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
    
    colors = ['#ff6b6b', '#4ecdc4', '#45b7d1']
    
    # 1. Lines of Code Comparison
    bars1 = ax1.bar(frameworks, lines_of_code, color=colors)
    ax1.set_title('Implementation Size (Lines of Code)', fontsize=14, fontweight='bold')
    ax1.set_ylabel('Lines of Code')
    for i, v in enumerate(lines_of_code):
        ax1.text(i, v + 20, str(v), ha='center', va='bottom', fontweight='bold')
    
    # 2. External Dependencies
    bars2 = ax2.bar(frameworks, dependencies, color=colors)
    ax2.set_title('External Dependencies', fontsize=14, fontweight='bold')
    ax2.set_ylabel('Number of Dependencies')
    for i, v in enumerate(dependencies):
        ax2.text(i, v + 0.05, str(v), ha='center', va='bottom', fontweight='bold')
    
    # 3. API Usage Breakdown
    width = 0.35
    x = range(len(frameworks))
    ax3.bar([i - width/2 for i in x], shared_usage, width, label='Shared APIs', color='lightgreen', alpha=0.8)
    ax3.bar([i + width/2 for i in x], framework_specific, width, label='Framework-specific APIs', color='lightcoral', alpha=0.8)
    ax3.set_title('API Usage Breakdown', fontsize=14, fontweight='bold')
    ax3.set_ylabel('API Call Count')
    ax3.set_xticks(x)
    ax3.set_xticklabels(frameworks)
    ax3.legend()
    
    # 4. Code Reusability Ratios
    bars4 = ax4.bar(frameworks, reusability_ratios, color=colors)
    ax4.set_title('Code Reusability Ratio', fontsize=14, fontweight='bold')
    ax4.set_ylabel('Shared API Usage (%)')
    ax4.set_ylim(0, 100)
    for i, v in enumerate(reusability_ratios):
        ax4.text(i, v + 1, f'{v:.1f}%', ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    plt.savefig('framework_integration_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    print("Visualization saved to: framework_integration_analysis.png")

if __name__ == '__main__':
    generate_compatibility_report()
    create_visualization()
