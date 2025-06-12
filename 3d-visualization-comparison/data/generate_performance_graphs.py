#!/usr/bin/env python3
"""
Performance Graph Generator for 3D Visualization Framework Comparison

This script generates time-series performance graphs from CSV data collected
during framework testing. It creates three types of visualizations:

1. Time-series graphs with phase backgrounds:
   - FPS (Frames Per Second) over time
   - Memory Usage over time  
   - Data Binding Latency over time

2. Phase analysis heatmaps:
   - Average performance metrics for each simulation phase
   - Individual heatmaps for each metric
   - Comprehensive normalized heatmap

3. Simulation phases analyzed:
   - 0-15s: Camera Movement (no data changes)
   - 15-60s: Low Visual Impact (data changes, low visual changes)
   - 60-90s: High Visual Impact (data changes, high visual changes)

Each graph shows data for all three frameworks (Three.js, Babylon.js, PlayCanvas)
with different colored lines for easy comparison.

Usage:
    python generate_performance_graphs.py [data_directory]
    
The script expects CSV files in one of these formats:
    {framework}_metrics_{timestamp}.csv
    {framework}_simulation_metrics_{timestamp}.csv
    
Where framework is one of: threejs, babylonjs, playcanvas
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import numpy as np
import os
import sys
import glob
import argparse
from pathlib import Path
import seaborn as sns

# Configuration
FRAMEWORKS = {
    'threejs': {'name': 'Three.js', 'color': '#ff6b6b', 'marker': 'o'},
    'babylonjs': {'name': 'Babylon.js', 'color': '#4ecdc4', 'marker': 's'},
    'playcanvas': {'name': 'PlayCanvas', 'color': '#45b7d1', 'marker': '^'}
}

# Simulation phases for heatmap analysis
SIMULATION_PHASES = [
    {
        'name': 'Camera Movement',
        'start': 0,
        'end': 15,
        'description': 'No data changes',
        'color': '#e8f4f8'
    },
    {
        'name': 'Low Visual Impact',
        'start': 15,
        'end': 60,
        'description': 'Data changes with low visual changes',
        'color': '#fff2cc'
    },
    {
        'name': 'High Visual Impact',
        'start': 60,
        'end': 90,
        'description': 'Data changes with high visual changes',
        'color': '#ffcccc'
    }
]

# Graph styling
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['figure.facecolor'] = 'white'
plt.rcParams['axes.facecolor'] = '#f8f9fa'
plt.rcParams['grid.alpha'] = 0.3
plt.rcParams['font.size'] = 10
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['legend.fontsize'] = 10

def find_csv_files(data_directory):
    """
    Find all CSV files matching the expected pattern in the data directory
    
    Args:
        data_directory (str): Path to directory containing CSV files
        
    Returns:
        dict: Dictionary mapping framework names to list of CSV file paths
    """
    csv_files = {}
    
    for framework in FRAMEWORKS.keys():
        # Try both patterns: regular metrics and simulation metrics
        patterns = [
            os.path.join(data_directory, f"{framework}_metrics_*.csv"),
            os.path.join(data_directory, f"{framework}_simulation_metrics_*.csv")
        ]
        
        files = []
        for pattern in patterns:
            files.extend(glob.glob(pattern))
        
        if files:
            csv_files[framework] = sorted(files)  # Sort by filename (which includes timestamp)
            print(f"Found {len(files)} CSV files for {framework}")
        else:
            print(f"Warning: No CSV files found for {framework} in {data_directory}")
    
    return csv_files

def parse_csv_file(filepath):
    """
    Parse a CSV file and extract time-series data
    
    Args:
        filepath (str): Path to the CSV file
        
    Returns:
        pd.DataFrame: DataFrame with time-series data, or None if parsing fails
    """
    try:
        # Read the entire file to find the time-series section
        with open(filepath, 'r') as f:
            lines = f.readlines()
        
        # Find the start of time-series data section
        time_series_start = None
        for i, line in enumerate(lines):
            if 'Time-Series Data' in line or 'Timestamp,FPS,Memory' in line:
                time_series_start = i
                break
            if line.strip().startswith('Timestamp,FPS,Memory'):
                time_series_start = i
                break
        
        if time_series_start is None:
            print(f"Warning: No time-series data found in {filepath}")
            return None
        
        # Find the actual header line
        header_line = None
        for i in range(time_series_start, min(time_series_start + 5, len(lines))):
            if lines[i].strip().startswith('Timestamp,FPS,Memory'):
                header_line = i
                break
        
        if header_line is None:
            print(f"Warning: No valid header found in time-series section of {filepath}")
            return None
        
        # Read from the header line onwards
        df = pd.read_csv(filepath, skiprows=header_line)
        
        # Clean up column names
        df.columns = df.columns.str.strip()
        
        # Convert timestamp to datetime
        if 'Timestamp' in df.columns:
            # Convert relative timestamps (seconds from start) to actual time
            df['Time'] = pd.to_numeric(df['Timestamp'], errors='coerce')
            df = df.dropna(subset=['Time'])
        else:
            print(f"Warning: No Timestamp column found in {filepath}")
            return None
        
        # Ensure numeric columns
        numeric_columns = ['FPS', 'Memory (MB)', 'Data Binding Latency (ms)']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Remove rows with all NaN values
        df = df.dropna(how='all', subset=numeric_columns)
        
        print(f"Loaded {len(df)} time-series data points from {os.path.basename(filepath)}")
        return df
        
    except Exception as e:
        print(f"Error parsing {filepath}: {str(e)}")
        return None

def create_performance_graphs(data_dict, output_dir):
    """
    Create three performance graphs from the collected data
    
    Args:
        data_dict (dict): Dictionary mapping framework names to DataFrames
        output_dir (str): Directory to save the generated graphs
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Define the three graphs to create
    graphs = [
        {
            'metric': 'FPS',
            'column': 'FPS',
            'title': 'Frames Per Second (FPS) Performance Comparison',
            'ylabel': 'FPS',
            'filename': 'fps_comparison.png'
        },
        {
            'metric': 'Memory',
            'column': 'Memory (MB)',
            'title': 'Memory Usage Comparison',
            'ylabel': 'Memory Usage (MB)',
            'filename': 'memory_comparison.png'
        },
        {
            'metric': 'Latency',
            'column': 'Data Binding Latency (ms)',
            'title': 'Data Binding Latency Comparison',
            'ylabel': 'Latency (ms)',
            'filename': 'latency_comparison.png'
        }
    ]
    
    for graph in graphs:
        create_single_graph(data_dict, graph, output_dir)
    
    # Create heatmaps for phase analysis
    create_heatmaps(data_dict, output_dir)

def create_single_graph(data_dict, graph_config, output_dir):
    """
    Create a single performance graph
    
    Args:
        data_dict (dict): Dictionary mapping framework names to DataFrames
        graph_config (dict): Configuration for the graph
        output_dir (str): Directory to save the graph
    """
    fig, ax = plt.subplots(figsize=(12, 8))  # Standard size since legends are inside now
    
    # Track if we have any data to plot
    has_data = False
    
    for framework, config in FRAMEWORKS.items():
        if framework in data_dict and not data_dict[framework].empty:
            df = data_dict[framework]
            
            if graph_config['column'] in df.columns:
                # Filter out invalid data points
                valid_data = df[df[graph_config['column']].notna() & 
                               (df[graph_config['column']] >= 0)]
                
                if len(valid_data) > 0:
                    ax.plot(valid_data['Time'], 
                           valid_data[graph_config['column']], 
                           label=config['name'],
                           color=config['color'],
                           marker=config['marker'],
                           markersize=4,
                           linewidth=2,
                           alpha=0.8)
                    has_data = True
                    
                    # Print statistics
                    mean_val = valid_data[graph_config['column']].mean()
                    std_val = valid_data[graph_config['column']].std()
                    print(f"{config['name']} {graph_config['metric']}: Mean={mean_val:.2f}, Std={std_val:.2f}")
    
    if not has_data:
        print(f"Warning: No valid data found for {graph_config['metric']} graph")
        plt.close(fig)
        return
    
    # Customize the graph
    ax.set_title(graph_config['title'], fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Time (seconds)', fontsize=12)
    ax.set_ylabel(graph_config['ylabel'], fontsize=12)
    
    # Add phase backgrounds
    add_phase_backgrounds(ax, alpha=0.2)
    
    # Add grid
    ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
    
    # Position framework legend in the bottom right corner where there's no data
    ax.legend(loc='lower right', bbox_to_anchor=(0.98, 0.02), 
             frameon=True, fancybox=True, shadow=True)
    
    # Set axis limits with some padding
    ax.margins(x=0.02, y=0.05)
    
    # Format y-axis based on metric type
    if graph_config['metric'] == 'FPS':
        ax.set_ylim(bottom=0)
    elif graph_config['metric'] == 'Memory':
        ax.set_ylim(bottom=0)
    elif graph_config['metric'] == 'Latency':
        ax.set_ylim(bottom=0)
        # Log scale might be useful for latency if values vary widely
        # ax.set_yscale('log')
    
    # Use tight layout for optimal spacing
    plt.tight_layout()
    
    # Save the graph
    output_path = os.path.join(output_dir, graph_config['filename'])
    plt.savefig(output_path, dpi=300, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    print(f"Saved {graph_config['metric']} graph to {output_path}")
    
    # Display the graph (comment out if running headless)
    # plt.show()
    
    plt.close(fig)

def create_heatmaps(data_dict, output_dir):
    """
    Create heatmaps showing performance metrics across simulation phases
    
    Args:
        data_dict (dict): Dictionary mapping framework names to DataFrames
        output_dir (str): Directory to save the generated graphs
    """
    metrics = ['FPS', 'Memory (MB)', 'Data Binding Latency (ms)']
    
    for metric in metrics:
        create_phase_heatmap(data_dict, metric, output_dir)
    
    # Create combined heatmap with all metrics
    create_combined_heatmap(data_dict, output_dir)

def create_phase_heatmap(data_dict, metric_column, output_dir):
    """
    Create a heatmap for a specific metric across simulation phases
    
    Args:
        data_dict (dict): Dictionary mapping framework names to DataFrames
        metric_column (str): Column name of the metric to analyze
        output_dir (str): Directory to save the graph
    """
    # Create a matrix to hold the phase averages
    frameworks = list(FRAMEWORKS.keys())
    phases = [phase['name'] for phase in SIMULATION_PHASES]
    
    # Initialize matrix
    heatmap_data = []
    framework_labels = []
    
    for framework in frameworks:
        if framework in data_dict and not data_dict[framework].empty:
            df = data_dict[framework]
            
            if metric_column in df.columns:
                framework_labels.append(FRAMEWORKS[framework]['name'])
                phase_values = []
                
                for phase in SIMULATION_PHASES:
                    # Filter data for this phase
                    phase_data = df[(df['Time'] >= phase['start']) & 
                                   (df['Time'] < phase['end']) & 
                                   (df[metric_column].notna())]
                    
                    if len(phase_data) > 0:
                        avg_value = phase_data[metric_column].mean()
                        phase_values.append(avg_value)
                    else:
                        phase_values.append(np.nan)
                
                heatmap_data.append(phase_values)
    
    if not heatmap_data:
        print(f"Warning: No data available for {metric_column} heatmap")
        return
    
    # Create the heatmap
    fig, ax = plt.subplots(figsize=(12, 6))  # Wider figure for better spacing
    
    # Convert to numpy array for better handling
    heatmap_array = np.array(heatmap_data)
    
    # Create heatmap with seaborn for better styling
    sns.heatmap(heatmap_array, 
                xticklabels=phases,
                yticklabels=framework_labels,
                annot=True, 
                fmt='.1f',
                cmap='YlOrRd',
                cbar_kws={'label': get_metric_unit(metric_column)},
                ax=ax)
    
    # Customize the plot
    metric_name = metric_column.replace(' (MB)', '').replace(' (ms)', '')
    ax.set_title(f'{metric_name} Performance by Simulation Phase', 
                fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Simulation Phase', fontsize=12)
    ax.set_ylabel('Framework', fontsize=12)
    
    # Rotate x-axis labels for better readability
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)
    
    plt.tight_layout()
    
    # Save the heatmap
    filename = f"{metric_name.lower().replace(' ', '_')}_phase_heatmap.png"
    output_path = os.path.join(output_dir, filename)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    print(f"Saved {metric_name} phase heatmap to {output_path}")
    
    plt.close(fig)

def create_combined_heatmap(data_dict, output_dir):
    """
    Create a combined heatmap showing normalized performance across all metrics and phases
    
    Args:
        data_dict (dict): Dictionary mapping framework names to DataFrames
        output_dir (str): Directory to save the graph
    """
    metrics = ['FPS', 'Memory (MB)', 'Data Binding Latency (ms)']
    frameworks = list(FRAMEWORKS.keys())
    phases = [phase['name'] for phase in SIMULATION_PHASES]
    
    # Create a comprehensive matrix
    all_data = []
    row_labels = []
    
    for framework in frameworks:
        if framework in data_dict and not data_dict[framework].empty:
            df = data_dict[framework]
            framework_name = FRAMEWORKS[framework]['name']
            
            for metric in metrics:
                if metric in df.columns:
                    row_labels.append(f"{framework_name} - {metric.replace(' (MB)', '').replace(' (ms)', '')}")
                    phase_values = []
                    
                    for phase in SIMULATION_PHASES:
                        # Filter data for this phase
                        phase_data = df[(df['Time'] >= phase['start']) & 
                                       (df['Time'] < phase['end']) & 
                                       (df[metric].notna())]
                        
                        if len(phase_data) > 0:
                            avg_value = phase_data[metric].mean()
                            phase_values.append(avg_value)
                        else:
                            phase_values.append(np.nan)
                    
                    all_data.append(phase_values)
    
    if not all_data:
        print("Warning: No data available for combined heatmap")
        return
    
    # Create the heatmap
    fig, ax = plt.subplots(figsize=(14, 10))  # Even wider for comprehensive heatmap
    
    # Convert to numpy array
    heatmap_array = np.array(all_data)
    
    # Normalize each metric separately for better comparison
    normalized_data = []
    current_metric = None
    metric_rows = []
    
    for i, label in enumerate(row_labels):
        metric_name = label.split(' - ')[1]
        if metric_name != current_metric:
            if metric_rows:
                # Normalize previous metric group
                metric_array = heatmap_array[metric_rows]
                if not np.all(np.isnan(metric_array)):
                    min_val = np.nanmin(metric_array)
                    max_val = np.nanmax(metric_array)
                    if max_val > min_val:
                        normalized_metric = (metric_array - min_val) / (max_val - min_val)
                    else:
                        normalized_metric = metric_array
                    for j, row_idx in enumerate(metric_rows):
                        normalized_data.append(normalized_metric[j])
            current_metric = metric_name
            metric_rows = [i]
        else:
            metric_rows.append(i)
    
    # Process the last metric group
    if metric_rows:
        metric_array = heatmap_array[metric_rows]
        if not np.all(np.isnan(metric_array)):
            min_val = np.nanmin(metric_array)
            max_val = np.nanmax(metric_array)
            if max_val > min_val:
                normalized_metric = (metric_array - min_val) / (max_val - min_val)
            else:
                normalized_metric = metric_array
            for j, row_idx in enumerate(metric_rows):
                normalized_data.append(normalized_metric[j])
    
    if normalized_data:
        normalized_array = np.array(normalized_data)
    else:
        normalized_array = heatmap_array
    
    # Create heatmap
    sns.heatmap(normalized_array, 
                xticklabels=phases,
                yticklabels=row_labels,
                annot=False,  # Too many values to annotate clearly
                cmap='RdYlBu_r',
                cbar_kws={'label': 'Normalized Performance (0=Best, 1=Worst)'},
                ax=ax)
    
    # Customize the plot
    ax.set_title('Comprehensive Performance Analysis by Simulation Phase', 
                fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Simulation Phase', fontsize=12)
    ax.set_ylabel('Framework - Metric', fontsize=12)
    
    # Rotate labels for better readability
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0, fontsize=9)
    
    plt.tight_layout()
    
    # Save the heatmap
    output_path = os.path.join(output_dir, 'comprehensive_phase_heatmap.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    print(f"Saved comprehensive phase heatmap to {output_path}")
    
    plt.close(fig)

def get_metric_unit(metric_column):
    """
    Get the appropriate unit label for a metric
    
    Args:
        metric_column (str): Column name of the metric
        
    Returns:
        str: Unit label for the metric
    """
    if 'FPS' in metric_column:
        return 'Frames/Second'
    elif 'Memory' in metric_column:
        return 'MB'
    elif 'Latency' in metric_column:
        return 'Milliseconds'
    else:
        return 'Value'

def add_phase_backgrounds(ax, alpha=0.3):
    """
    Add colored backgrounds to show simulation phases on a time-series plot
    
    Args:
        ax: Matplotlib axis object
        alpha (float): Transparency of the background colors
    """
    y_min, y_max = ax.get_ylim()
    
    for phase in SIMULATION_PHASES:
        ax.axvspan(phase['start'], phase['end'], 
                  color=phase['color'], alpha=alpha, 
                  label=f"{phase['name']}: {phase['description']}")
    
    # Add phase transition lines
    for phase in SIMULATION_PHASES[1:]:  # Skip first phase start
        ax.axvline(x=phase['start'], color='gray', linestyle='--', 
                  alpha=0.7, linewidth=1)

def combine_multiple_runs(dataframes_list):
    """
    Combine multiple test runs for the same framework
    
    Args:
        dataframes_list (list): List of DataFrames from different runs
        
    Returns:
        pd.DataFrame: Combined DataFrame with averaged metrics
    """
    if not dataframes_list:
        return pd.DataFrame()
    
    if len(dataframes_list) == 1:
        return dataframes_list[0]
    
    # For now, just return the most recent run (last in sorted list)
    # Could be enhanced to average multiple runs
    return dataframes_list[-1]

def main():
    """Main function to orchestrate graph generation"""
    parser = argparse.ArgumentParser(
        description='Generate performance graphs from 3D visualization framework test data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python generate_performance_graphs.py
    python generate_performance_graphs.py ./test_data
    python generate_performance_graphs.py /path/to/csv/files --output ./graphs
        """
    )
    
    parser.add_argument('data_dir', nargs='?', default='.',
                        help='Directory containing CSV files (default: current directory)')
    parser.add_argument('--output', '-o', default='./performance_graphs',
                        help='Output directory for generated graphs (default: ./performance_graphs)')
    
    args = parser.parse_args()
    
    data_directory = os.path.abspath(args.data_dir)
    output_directory = os.path.abspath(args.output)
    
    print(f"Looking for CSV files in: {data_directory}")
    print(f"Output directory: {output_directory}")
    
    # Find CSV files
    csv_files = find_csv_files(data_directory)
    
    if not csv_files:
        print("Error: No CSV files found matching the expected pattern")
        print("Expected files like: threejs_metrics_*.csv, babylonjs_metrics_*.csv, playcanvas_metrics_*.csv")
        return 1
    
    # Parse CSV files and collect data
    framework_data = {}
    
    for framework, files in csv_files.items():
        dataframes = []
        for filepath in files:
            df = parse_csv_file(filepath)
            if df is not None and not df.empty:
                dataframes.append(df)
        
        if dataframes:
            # Combine multiple runs (for now, just use the latest)
            framework_data[framework] = combine_multiple_runs(dataframes)
    
    if not framework_data:
        print("Error: No valid time-series data found in any CSV files")
        return 1
    
    print(f"\nGenerating performance graphs for {len(framework_data)} frameworks...")
    print("Creating time-series graphs with phase backgrounds...")
    print("Creating phase analysis heatmaps...")
    
    # Create performance graphs
    create_performance_graphs(framework_data, output_directory)
    
    print(f"\nGraph generation complete! Check {output_directory} for the generated images.")
    print("Generated files:")
    print("  - fps_comparison.png (FPS time-series with phase backgrounds)")
    print("  - memory_comparison.png (Memory time-series with phase backgrounds)")
    print("  - latency_comparison.png (Latency time-series with phase backgrounds)")
    print("  - fps_phase_heatmap.png (FPS averages by phase)")
    print("  - memory_phase_heatmap.png (Memory averages by phase)")
    print("  - data_binding_latency_phase_heatmap.png (Latency averages by phase)")
    print("  - comprehensive_phase_heatmap.png (All metrics normalized by phase)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
