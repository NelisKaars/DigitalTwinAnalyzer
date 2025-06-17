#!/usr/bin/env python3
"""
Stress Test Analysis and Visualization
Generates graphs and tables for thesis stress testing section
Enhanced to support both phase summary and detailed time-series data
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from pathlib import Path
import glob
import argparse

def load_stress_test_data():
    """Load stress test CSV files for all frameworks (phase summary data)"""
    data = {}
    
    # Look for stress test summary CSV files
    csv_files = glob.glob("*_stress_test_summary_*.csv")
    
    for csv_file in csv_files:
        # Extract framework name from filename
        framework = csv_file.split('_stress_test_summary_')[0]
        
        try:
            # Read the entire file as text first to find the data section
            with open(csv_file, 'r') as f:
                lines = f.readlines()
            
            # Find the line with the CSV header
            data_start_line = None
            for i, line in enumerate(lines):
                if 'Target_Frequency_Hz,Actual_Frequency_Hz,FPS' in line:
                    data_start_line = i
                    break
            
            if data_start_line is not None:
                # Read only the data section, skipping the header comments
                df = pd.read_csv(csv_file, skiprows=data_start_line)
                
                # Stop reading when we hit the summary section
                summary_start = None
                for i, row in df.iterrows():
                    if pd.isna(row['Target_Frequency_Hz']) or '===' in str(row['Target_Frequency_Hz']):
                        summary_start = i
                        break
                
                if summary_start is not None:
                    df = df.iloc[:summary_start]
                
                # Clean up the data - ensure numeric columns are numeric
                numeric_columns = ['Target_Frequency_Hz', 'Actual_Frequency_Hz', 'FPS', 'FPS_Drop_Percent', 
                                 'Latency_ms', 'Memory_MB', 'Dropped_Updates', 'Sync_Issues', 
                                 'Updates_Performed', 'Phase_Duration_s']
                
                for col in numeric_columns:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                
                # Remove any rows with NaN in key columns
                df = df.dropna(subset=['Target_Frequency_Hz', 'FPS'])
                
                if not df.empty:
                    data[framework] = df
                    print(f"Loaded {framework} summary data: {len(df)} frequency points")
                else:
                    print(f"Warning: No valid data found in {csv_file}")
            else:
                print(f"Warning: Could not find CSV header in {csv_file}")
                
        except Exception as e:
            print(f"Error loading {csv_file}: {e}")
    
    return data

def load_timeseries_data():
    """Load time-series stress test CSV files for all frameworks"""
    data = {}
    
    # Look for time-series CSV files
    csv_files = glob.glob("*_stress_test_timeseries_*.csv")
    
    for csv_file in csv_files:
        # Extract framework name from filename
        framework = csv_file.split('_stress_test_timeseries_')[0]
        
        try:
            # Read the entire file as text first to find the data section
            with open(csv_file, 'r') as f:
                lines = f.readlines()
            
            # Find the line with the CSV header
            data_start_line = None
            for i, line in enumerate(lines):
                if 'Timestamp_ms,Test_Time_s,Phase' in line:
                    data_start_line = i
                    break
            
            if data_start_line is not None:
                # Read only the data section
                df = pd.read_csv(csv_file, skiprows=data_start_line)
                
                # Clean up the data - ensure numeric columns are numeric
                numeric_columns = ['Timestamp_ms', 'Test_Time_s', 'Phase', 'Phase_Elapsed_s', 
                                 'Target_Frequency_Hz', 'Actual_Frequency_Hz', 'Frequency_Ratio',
                                 'FPS', 'Render_Time_ms', 'Memory_MB', 'Total_Updates', 
                                 'Dropped_Updates', 'Sync_Issues']
                
                for col in numeric_columns:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                
                # Remove any rows with NaN in key columns
                df = df.dropna(subset=['Test_Time_s', 'FPS', 'Target_Frequency_Hz'])
                
                if not df.empty:
                    data[framework] = df
                    print(f"Loaded {framework} time-series data: {len(df)} data points")
                else:
                    print(f"Warning: No valid time-series data found in {csv_file}")
            else:
                print(f"Warning: Could not find time-series CSV header in {csv_file}")
                
        except Exception as e:
            print(f"Error loading time-series {csv_file}: {e}")
    
    return data

def generate_timeseries_fps_graph(timeseries_data, output_dir):
    """Generate detailed time-series FPS graph with data throughput overlay"""
    fig, ax1 = plt.subplots(1, 1, figsize=(16, 10))
    
    colors = {'threejs': '#ff6b6b', 'babylonjs': '#4ecdc4', 'playcanvas': '#45b7d1'}
    markers = {'threejs': 'o', 'babylonjs': 's', 'playcanvas': '^'}
    
    # Plot FPS for each framework on primary y-axis
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax1.plot(df['Test_Time_s'], df['FPS'], 
                    color=colors.get(framework, '#333333'),
                    linewidth=3, 
                    label=f'{framework.capitalize()} FPS', 
                    marker=markers.get(framework, 'o'),
                    markersize=4, alpha=0.9, markevery=5)
    
    # Create secondary y-axis for data throughput
    ax2 = ax1.twinx()
    
    # Plot target throughput as background reference
    if timeseries_data:
        sample_df = list(timeseries_data.values())[0]
        ax2.fill_between(sample_df['Test_Time_s'], sample_df['Target_Frequency_Hz'], 
                         alpha=0.15, color='gray', label='Target Throughput')
        
        # Plot actual throughput for each framework with distinct colors
        throughput_colors = {'threejs': '#cc5555', 'babylonjs': '#3ca5a5', 'playcanvas': '#2e8eb8'}
        throughput_styles = {'threejs': ':', 'babylonjs': '-.', 'playcanvas': '--'}
        
        for framework, df in timeseries_data.items():
            if not df.empty:
                ax2.plot(df['Test_Time_s'], df['Actual_Frequency_Hz'], 
                         color=throughput_colors.get(framework, '#666666'),
                         linewidth=2.5, alpha=0.8, 
                         linestyle=throughput_styles.get(framework, ':'),
                         label=f'{framework.capitalize()} Actual Data Throughput')

        # Add phase boundaries and labels
        phase_changes = sample_df.groupby('Phase')['Test_Time_s'].min()
        
        for phase, time in phase_changes.items():
            ax1.axvline(x=time, color='gray', linestyle=':', alpha=0.6, linewidth=1)
            target_freq = sample_df[sample_df['Phase'] == phase]['Target_Frequency_Hz'].iloc[0]
            # Position labels at top of the plot
            ax1.text(time + 1, ax1.get_ylim()[1] * 0.95, f'Phase {int(phase)}\n{int(target_freq)}Hz', 
                    ha='left', va='top', fontsize=9, alpha=0.8, 
                    bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.7))
    
    # Customize axes
    ax1.set_title('FPS Performance vs Data Update Throughput - Stress Test', 
                 fontsize=18, fontweight='bold', pad=20)
    ax1.set_xlabel('Test Time (seconds)', fontsize=14, fontweight='bold')
    ax1.set_ylabel('FPS (Frames Per Second)', fontsize=14, fontweight='bold', color='blue')
    ax2.set_ylabel('Target Data Throughput (Hz)', fontsize=14, fontweight='bold', color='orange')
    
    # Style the axes
    ax1.tick_params(axis='y', labelcolor='blue', labelsize=12)
    ax2.tick_params(axis='y', labelcolor='orange', labelsize=12)
    ax1.tick_params(axis='x', labelsize=12)
    
    ax1.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
    ax1.set_ylim(0, None)
    ax2.set_ylim(0, max(sample_df['Target_Frequency_Hz']) * 1.1)
    
    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    legend = ax1.legend(lines1 + lines2, labels1 + labels2, 
              loc='upper right', fontsize=12, framealpha=1.0, 
              facecolor='white', edgecolor='black', frameon=True)
    legend.get_frame().set_facecolor('white')
    legend.get_frame().set_edgecolor('black')
    legend.get_frame().set_linewidth(1)
    legend.get_frame().set_alpha(1.0)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/stress_test_timeseries_fps.png', dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated: {output_dir}/stress_test_timeseries_fps.png")

def generate_timeseries_frequency_accuracy_graph(timeseries_data, output_dir):
    """Generate frequency accuracy over time graph"""
    plt.figure(figsize=(16, 10))
    
    colors = {'threejs': '#ff6b6b', 'babylonjs': '#4ecdc4', 'playcanvas': '#45b7d1'}
    
    for framework, df in timeseries_data.items():
        if not df.empty:
            plt.plot(df['Test_Time_s'], df['Frequency_Ratio'], 
                    color=colors.get(framework, '#333333'),
                    linewidth=2, 
                    label=f'{framework.capitalize()} Accuracy', alpha=0.8)
    
    # Add target line (perfect accuracy = 1.0)
    plt.axhline(y=1.0, color='black', linestyle='-', alpha=0.3, label='Perfect Accuracy')
    plt.axhline(y=0.8, color='red', linestyle='--', alpha=0.5, label='80% Threshold')
    
    # Add phase boundaries
    if timeseries_data:
        sample_df = list(timeseries_data.values())[0]
        phase_changes = sample_df.groupby('Phase')['Test_Time_s'].min()
        
        for phase, time in phase_changes.items():
            plt.axvline(x=time, color='gray', linestyle='--', alpha=0.5)
            target_freq = sample_df[sample_df['Phase'] == phase]['Target_Frequency_Hz'].iloc[0]
            plt.text(time + 1, 1.2, f'{int(target_freq)}Hz', 
                    rotation=90, fontsize=10, alpha=0.7)
    
    plt.xlabel('Test Time (seconds)', fontsize=14, fontweight='bold')
    plt.ylabel('Frequency Accuracy Ratio (Actual/Target)', fontsize=14, fontweight='bold')
    plt.title('Update Frequency Accuracy Over Time', fontsize=16, fontweight='bold')
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=12)
    plt.ylim(0, 1.3)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/stress_test_timeseries_frequency_accuracy.png', dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated: {output_dir}/stress_test_timeseries_frequency_accuracy.png")

def generate_timeseries_memory_graph(timeseries_data, output_dir):
    """Generate memory usage over time graph with data throughput overlay"""
    fig, ax1 = plt.subplots(1, 1, figsize=(16, 10))
    
    colors = {'threejs': '#ff6b6b', 'babylonjs': '#4ecdc4', 'playcanvas': '#45b7d1'}
    markers = {'threejs': 'o', 'babylonjs': 's', 'playcanvas': '^'}
    
    # Plot memory usage for each framework on primary y-axis
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax1.plot(df['Test_Time_s'], df['Memory_MB'], 
                    color=colors.get(framework, '#333333'),
                    linewidth=3, 
                    label=f'{framework.capitalize()} Memory', 
                    marker=markers.get(framework, 'o'),
                    markersize=4, alpha=0.9, markevery=5)
    
    # Create secondary y-axis for data throughput
    ax2 = ax1.twinx()
    
    # Plot target throughput as background reference
    if timeseries_data:
        sample_df = list(timeseries_data.values())[0]
        ax2.fill_between(sample_df['Test_Time_s'], sample_df['Target_Frequency_Hz'], 
                         alpha=0.15, color='gray', label='Target Throughput')
        
        # Plot actual throughput for each framework with distinct colors
        throughput_colors = {'threejs': '#cc5555', 'babylonjs': '#3ca5a5', 'playcanvas': '#2e8eb8'}
        throughput_styles = {'threejs': ':', 'babylonjs': '-.', 'playcanvas': '--'}
        
        for framework, df in timeseries_data.items():
            if not df.empty:
                ax2.plot(df['Test_Time_s'], df['Actual_Frequency_Hz'], 
                         color=throughput_colors.get(framework, '#666666'),
                         linewidth=2.5, alpha=0.8, 
                         linestyle=throughput_styles.get(framework, ':'),
                         label=f'{framework.capitalize()} Actual')
        
        # Add phase boundaries and labels - positioned better for memory graph
        phase_changes = sample_df.groupby('Phase')['Test_Time_s'].min()
        
        for i, (phase, time) in enumerate(phase_changes.items()):
            ax1.axvline(x=time, color='gray', linestyle=':', alpha=0.6, linewidth=1)
            target_freq = sample_df[sample_df['Phase'] == phase]['Target_Frequency_Hz'].iloc[0]
            # Position labels at the bottom to avoid overlap with memory values
            ax1.text(time + 2, ax1.get_ylim()[0] + (ax1.get_ylim()[1] - ax1.get_ylim()[0]) * 0.05, 
                    f'P{int(phase)}: {int(target_freq)}Hz', 
                    ha='left', va='bottom', fontsize=9, alpha=0.8, rotation=45,
                    bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.8))
    
    # Customize axes
    ax1.set_title('Memory Usage vs Data Update Throughput - Stress Test', 
                 fontsize=18, fontweight='bold', pad=20)
    ax1.set_xlabel('Test Time (seconds)', fontsize=14, fontweight='bold')
    ax1.set_ylabel('Memory Usage (MB)', fontsize=14, fontweight='bold', color='green')
    ax2.set_ylabel('Actual Data Throughput (Hz)', fontsize=14, fontweight='bold', color='orange')
    
    # Style the axes
    ax1.tick_params(axis='y', labelcolor='green', labelsize=12)
    ax2.tick_params(axis='y', labelcolor='orange', labelsize=12)
    ax1.tick_params(axis='x', labelsize=12)
    
    ax1.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
    ax1.set_ylim(None, None)
    ax2.set_ylim(0, max(sample_df['Target_Frequency_Hz']) * 1.1)
    
    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    legend = ax1.legend(lines1 + lines2, labels1 + labels2, 
              loc='upper left', fontsize=12, framealpha=1.0, 
              facecolor='white', edgecolor='black', frameon=True)
    legend.get_frame().set_facecolor('white')
    legend.get_frame().set_edgecolor('black')
    legend.get_frame().set_linewidth(1)
    legend.get_frame().set_alpha(1.0)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/stress_test_timeseries_memory.png', dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated: {output_dir}/stress_test_timeseries_memory.png")

def generate_timeseries_latency_graph(timeseries_data, output_dir):
    """Generate latency (render time) over time graph with data throughput overlay"""
    fig, ax1 = plt.subplots(1, 1, figsize=(16, 10))
    
    colors = {'threejs': '#ff6b6b', 'babylonjs': '#4ecdc4', 'playcanvas': '#45b7d1'}
    markers = {'threejs': 'o', 'babylonjs': 's', 'playcanvas': '^'}
    
    # Plot latency (render time) for each framework on primary y-axis
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax1.plot(df['Test_Time_s'], df['Render_Time_ms'], 
                    color=colors.get(framework, '#333333'),
                    linewidth=3, 
                    label=f'{framework.capitalize()} Latency', 
                    marker=markers.get(framework, 'o'),
                    markersize=4, alpha=0.9, markevery=5)
    
    # Create secondary y-axis for data throughput
    ax2 = ax1.twinx()
    
    # Plot target throughput as background reference
    if timeseries_data:
        sample_df = list(timeseries_data.values())[0]
        ax2.fill_between(sample_df['Test_Time_s'], sample_df['Target_Frequency_Hz'], 
                         alpha=0.15, color='gray', label='Target Throughput')
        
        # Plot actual throughput for each framework with distinct colors
        throughput_colors = {'threejs': '#cc5555', 'babylonjs': '#3ca5a5', 'playcanvas': '#2e8eb8'}
        throughput_styles = {'threejs': ':', 'babylonjs': '-.', 'playcanvas': '--'}
        
        for framework, df in timeseries_data.items():
            if not df.empty:
                ax2.plot(df['Test_Time_s'], df['Actual_Frequency_Hz'], 
                         color=throughput_colors.get(framework, '#666666'),
                         linewidth=2.5, alpha=0.8, 
                         linestyle=throughput_styles.get(framework, ':'),
                         label=f'{framework.capitalize()} Actual')
        
        # Add phase boundaries and labels
        phase_changes = sample_df.groupby('Phase')['Test_Time_s'].min()
        
        for phase, time in phase_changes.items():
            ax1.axvline(x=time, color='gray', linestyle=':', alpha=0.6, linewidth=1)
            target_freq = sample_df[sample_df['Phase'] == phase]['Target_Frequency_Hz'].iloc[0]
            # Position labels at middle-right of the plot
            ax1.text(time + 1, ax1.get_ylim()[1] * 0.75, f'P{int(phase)}: {int(target_freq)}Hz', 
                    ha='left', va='center', fontsize=9, alpha=0.8, rotation=90,
                    bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.8))
    
    # Customize axes
    ax1.set_title('Render Latency vs Data Update Throughput - Stress Test', 
                 fontsize=18, fontweight='bold', pad=20)
    ax1.set_xlabel('Test Time (seconds)', fontsize=14, fontweight='bold')
    ax1.set_ylabel('Render Time (ms)', fontsize=14, fontweight='bold', color='red')
    ax2.set_ylabel('Actual Data Throughput (Hz)', fontsize=14, fontweight='bold', color='orange')
    
    # Style the axes
    ax1.tick_params(axis='y', labelcolor='red', labelsize=12)
    ax2.tick_params(axis='y', labelcolor='orange', labelsize=12)
    ax1.tick_params(axis='x', labelsize=12)
    
    ax1.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
    ax1.set_ylim(0, None)
    ax2.set_ylim(0, max(sample_df['Actual_Frequency_Hz']) * 1.1)
    
    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    legend = ax1.legend(lines1 + lines2, labels1 + labels2, 
              loc='upper left', fontsize=12, framealpha=1.0, 
              facecolor='white', edgecolor='black', frameon=True)
    legend.get_frame().set_facecolor('white')
    legend.get_frame().set_edgecolor('black')
    legend.get_frame().set_linewidth(1)
    legend.get_frame().set_alpha(1.0)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/stress_test_timeseries_latency.png', dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated: {output_dir}/stress_test_timeseries_latency.png")

def generate_fps_stress_graph(data, output_dir):
    """Generate FPS under increasing update frequency graph"""
    plt.figure(figsize=(12, 8))
    
    colors = {'threejs': '#ff6b6b', 'babylonjs': '#4ecdc4', 'playcanvas': '#45b7d1'}
    markers = {'threejs': 'o', 'babylonjs': 's', 'playcanvas': '^'}
    
    for framework, df in data.items():
        if not df.empty:
            plt.plot(df['Target_Frequency_Hz'], df['FPS'], 
                    color=colors.get(framework, '#333333'),
                    marker=markers.get(framework, 'o'),
                    linewidth=2.5, markersize=8, 
                    label=framework.capitalize(), alpha=0.8)
    
    plt.xlabel('Update Frequency (Hz)', fontsize=14, fontweight='bold')
    plt.ylabel('Frames Per Second (FPS)', fontsize=14, fontweight='bold')
    plt.title('FPS Performance Under Increasing Update Frequency', fontsize=16, fontweight='bold')
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=12, loc='upper right')
    plt.xlim(0, 55)
    plt.ylim(0, None)
    
    # Add annotation for critical points
    for framework, df in data.items():
        if not df.empty:
            critical_point = df[df['FPS_Drop_Percent'] > 30]
            if not critical_point.empty:
                first_critical = critical_point.iloc[0]
                plt.annotate(f'{framework}\nDegrades at {first_critical["Target_Frequency_Hz"]}Hz',
                           xy=(first_critical['Target_Frequency_Hz'], first_critical['FPS']),
                           xytext=(first_critical['Target_Frequency_Hz'] + 5, first_critical['FPS'] + 5),
                           arrowprops=dict(arrowstyle='->', color=colors.get(framework, '#333333')),
                           fontsize=10, alpha=0.8)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/fps_under_stress.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Generated: fps_under_stress.png")

def generate_memory_stress_graph(data, output_dir):
    """Generate memory usage bar chart at 50Hz"""
    plt.figure(figsize=(10, 6))
    
    frameworks = []
    memory_values = []
    colors_list = []
    
    colors = {'threejs': '#ff6b6b', 'babylonjs': '#4ecdc4', 'playcanvas': '#45b7d1'}
    
    for framework, df in data.items():
        if not df.empty:
            # Get memory usage at highest frequency (50Hz or closest)
            highest_freq_row = df.loc[df['Target_Frequency_Hz'].idxmax()]
            frameworks.append(framework.capitalize())
            memory_values.append(highest_freq_row['Memory_MB'])
            colors_list.append(colors.get(framework, '#333333'))
    
    bars = plt.bar(frameworks, memory_values, color=colors_list, alpha=0.8, edgecolor='black', linewidth=1)
    
    # Add value labels on bars
    for bar, value in zip(bars, memory_values):
        plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                f'{value:.1f} MB', ha='center', va='bottom', fontweight='bold', fontsize=12)
    
    plt.xlabel('Framework', fontsize=14, fontweight='bold')
    plt.ylabel('Memory Usage (MB)', fontsize=14, fontweight='bold')
    plt.title('Memory Usage at Maximum Update Frequency (50Hz)', fontsize=16, fontweight='bold')
    plt.grid(True, axis='y', alpha=0.3)
    plt.ylim(0, max(memory_values) * 1.15)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/memory_stress_bar.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Generated: memory_stress_bar.png")

def generate_latency_heatmap(data, output_dir):
    """Generate latency heatmap across frequencies"""
    plt.figure(figsize=(12, 8))
    
    # Prepare data for heatmap
    frameworks = list(data.keys())
    frequencies = [1, 5, 10, 25, 50]
    latency_matrix = []
    
    for framework in frameworks:
        df = data[framework]
        framework_latencies = []
        for freq in frequencies:
            freq_data = df[df['Target_Frequency_Hz'] == freq]
            if not freq_data.empty:
                framework_latencies.append(freq_data['Latency_ms'].iloc[0])
            else:
                framework_latencies.append(np.nan)
        latency_matrix.append(framework_latencies)
    
    # Create heatmap
    latency_df = pd.DataFrame(latency_matrix, 
                             index=[f.capitalize() for f in frameworks], 
                             columns=[f'{f}Hz' for f in frequencies])
    
    sns.heatmap(latency_df, annot=True, fmt='.1f', cmap='YlOrRd', 
                cbar_kws={'label': 'Latency (ms)'}, linewidths=0.5)
    
    plt.title('Update Latency Across Frequencies', fontsize=16, fontweight='bold')
    plt.xlabel('Update Frequency', fontsize=14, fontweight='bold')
    plt.ylabel('Framework', fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/latency_heatmap.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Generated: latency_heatmap.png")

def generate_summary_table(data, output_dir):
    """Generate summary table with key metrics"""
    summary_data = []
    
    for framework, df in data.items():
        if df.empty:
            continue
            
        # Calculate max stable rate (last frequency with <30% FPS drop)
        stable_rates = df[df['FPS_Drop_Percent'] < 30]
        max_stable_rate = stable_rates['Target_Frequency_Hz'].max() if not stable_rates.empty else 1
        
        # Calculate average FPS drop
        avg_fps_drop = df['FPS_Drop_Percent'].mean()
        
        # Calculate total missed updates
        total_missed = df['Dropped_Updates'].sum()
        
        # Determine observations
        observations = []
        if max_stable_rate < 10:
            observations.append("Struggles with high frequency")
        elif max_stable_rate >= 50:
            observations.append("Stable throughout")
        else:
            observations.append(f"Stutters above {max_stable_rate}Hz")
        
        if total_missed > 20:
            observations.append("High update loss")
        elif total_missed < 5:
            observations.append("Minimal losses")
        
        summary_data.append({
            'Framework': framework.capitalize(),
            'Max_Stable_Rate_Hz': int(max_stable_rate),
            'FPS_Drop_Percent': f"{avg_fps_drop:.0f}",
            'Missed_Updates': int(total_missed),
            'Observations': "; ".join(observations)
        })
    
    # Save as CSV for easy copying to LaTeX
    summary_df = pd.DataFrame(summary_data)
    summary_df.to_csv(f'{output_dir}/stress_test_summary.csv', index=False)
    
    # Print LaTeX table format
    print("\n=== LaTeX Table Format ===")
    print("\\begin{tabularx}{\\linewidth}{l *{4}{>{\\centering\\arraybackslash}X}}")
    print("\\toprule")
    print("\\textbf{Framework} & \\textbf{Max Stable Rate (Hz)} & \\textbf{FPS Drop (\\%)} & \\textbf{Missed Updates} & \\textbf{Observations} \\\\\\\\")
    print("\\midrule")
    
    for _, row in summary_df.iterrows():
        print(f"{row['Framework']} & {row['Max_Stable_Rate_Hz']} & {row['FPS_Drop_Percent']} & {row['Missed_Updates']} & {row['Observations']} \\\\\\\\")
    
    print("\\bottomrule")
    print("\\end{tabularx}")
    
    return summary_df

def generate_comprehensive_stress_test_graph(timeseries_data, output_dir):
    """Generate comprehensive stress test graph with all metrics and data throughput"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(20, 12))
    
    colors = {'threejs': '#ff6b6b', 'babylonjs': '#4ecdc4', 'playcanvas': '#45b7d1'}
    markers = {'threejs': 'o', 'babylonjs': 's', 'playcanvas': '^'}
    
    if not timeseries_data:
        return
    
    sample_df = list(timeseries_data.values())[0]
    
    # 1. FPS vs Throughput (top-left)
    ax1_twin = ax1.twinx()
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax1.plot(df['Test_Time_s'], df['FPS'], 
                    color=colors.get(framework, '#333333'),
                    linewidth=2.5, label=f'{framework.capitalize()} FPS',
                    marker=markers.get(framework, 'o'), markersize=3, alpha=0.9, markevery=8)
    
    # Plot target throughput as background and individual actual throughput
    ax1_twin.fill_between(sample_df['Test_Time_s'], sample_df['Target_Frequency_Hz'], 
                         alpha=0.15, color='gray', label='Target')
    
    throughput_colors = {'threejs': '#cc5555', 'babylonjs': '#3ca5a5', 'playcanvas': '#2e8eb8'}
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax1_twin.plot(df['Test_Time_s'], df['Actual_Frequency_Hz'], 
                         color=throughput_colors.get(framework, '#666666'),
                         linewidth=1.5, alpha=0.7, linestyle=':', 
                         label=f'{framework.capitalize()[:4]} Actual')
    
    ax1.set_title('FPS vs Data Throughput', fontsize=14, fontweight='bold')
    ax1.set_ylabel('FPS', fontsize=12, color='blue')
    ax1_twin.set_ylabel('Throughput (Hz)', fontsize=12, color='orange')
    ax1.tick_params(axis='y', labelcolor='blue')
    ax1_twin.tick_params(axis='y', labelcolor='orange')
    ax1.grid(True, alpha=0.3)
    
    # 2. Memory vs Throughput (top-right)
    ax2_twin = ax2.twinx()
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax2.plot(df['Test_Time_s'], df['Memory_MB'], 
                    color=colors.get(framework, '#333333'),
                    linewidth=2.5, label=f'{framework.capitalize()} Memory',
                    marker=markers.get(framework, 'o'), markersize=3, alpha=0.9, markevery=8)
    
    # Plot target throughput as background and individual actual throughput
    ax2_twin.fill_between(sample_df['Test_Time_s'], sample_df['Target_Frequency_Hz'], 
                         alpha=0.15, color='gray')
    
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax2_twin.plot(df['Test_Time_s'], df['Actual_Frequency_Hz'], 
                         color=throughput_colors.get(framework, '#666666'),
                         linewidth=1.5, alpha=0.7, linestyle=':')
    
    ax2.set_title('Memory vs Data Throughput', fontsize=14, fontweight='bold')
    ax2.set_ylabel('Memory (MB)', fontsize=12, color='green')
    ax2_twin.set_ylabel('Throughput (Hz)', fontsize=12, color='orange')
    ax2.tick_params(axis='y', labelcolor='green')
    ax2_twin.tick_params(axis='y', labelcolor='orange')
    ax2.grid(True, alpha=0.3)
    
    # 3. Latency vs Throughput (bottom-left)
    ax3_twin = ax3.twinx()
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax3.plot(df['Test_Time_s'], df['Render_Time_ms'], 
                    color=colors.get(framework, '#333333'),
                    linewidth=2.5, label=f'{framework.capitalize()} Latency',
                    marker=markers.get(framework, 'o'), markersize=3, alpha=0.9, markevery=8)
    
    # Plot target throughput as background and individual actual throughput
    ax3_twin.fill_between(sample_df['Test_Time_s'], sample_df['Target_Frequency_Hz'], 
                         alpha=0.15, color='gray')
    
    for framework, df in timeseries_data.items():
        if not df.empty:
            ax3_twin.plot(df['Test_Time_s'], df['Actual_Frequency_Hz'], 
                         color=throughput_colors.get(framework, '#666666'),
                         linewidth=1.5, alpha=0.7, linestyle=':')
    
    ax3.set_title('Render Latency vs Data Throughput', fontsize=14, fontweight='bold')
    ax3.set_ylabel('Render Time (ms)', fontsize=12, color='red')
    ax3_twin.set_ylabel('Throughput (Hz)', fontsize=12, color='orange')
    ax3.tick_params(axis='y', labelcolor='red')
    ax3_twin.tick_params(axis='y', labelcolor='orange')
    ax3.set_xlabel('Test Time (seconds)', fontsize=12)
    ax3.grid(True, alpha=0.3)
    ax3.set_ylim(0, None)
    
    # 4. Phase Summary (bottom-right)
    phase_summary = []
    for phase in sorted(sample_df['Phase'].unique()):
        phase_data = sample_df[sample_df['Phase'] == phase]
        target_freq = phase_data['Target_Frequency_Hz'].iloc[0]
        phase_summary.append(f"Phase {int(phase)}: {int(target_freq)}Hz")
    
    ax4.text(0.1, 0.9, "Test Phases:", fontsize=14, fontweight='bold', transform=ax4.transAxes)
    for i, phase_text in enumerate(phase_summary):
        ax4.text(0.1, 0.8 - i*0.12, phase_text, fontsize=12, transform=ax4.transAxes)
    
    # Add phase boundaries to all subplots
    phase_changes = sample_df.groupby('Phase')['Test_Time_s'].min()
    for phase, time in phase_changes.items():
        for ax in [ax1, ax2, ax3]:
            ax.axvline(x=time, color='gray', linestyle=':', alpha=0.6, linewidth=1)
    
    ax4.text(0.1, 0.4, "Stress Test Overview:", fontsize=14, fontweight='bold', transform=ax4.transAxes)
    ax4.text(0.1, 0.3, f"• Total Duration: {int(sample_df['Test_Time_s'].max())}s", fontsize=12, transform=ax4.transAxes)
    ax4.text(0.1, 0.2, f"• Data Points: {len(sample_df)}", fontsize=12, transform=ax4.transAxes)
    ax4.text(0.1, 0.1, f"• Max Throughput: {int(sample_df['Actual_Frequency_Hz'].max())}Hz", fontsize=12, transform=ax4.transAxes)
    
    ax4.set_xlim(0, 1)
    ax4.set_ylim(0, 1)
    ax4.axis('off')
    
    # Overall title
    fig.suptitle('Comprehensive Stress Test Analysis - Digital Twin Performance Under Load', 
                fontsize=18, fontweight='bold', y=0.98)
    
    # Create a unified legend
    handles, labels = [], []
    for ax in [ax1, ax2, ax3]:
        h, l = ax.get_legend_handles_labels()
        handles.extend(h)
        labels.extend(l)
    
    # Remove duplicates while preserving order
    unique_labels = []
    unique_handles = []
    for handle, label in zip(handles, labels):
        if label not in unique_labels:
            unique_labels.append(label)
            unique_handles.append(handle)
    
    fig.legend(unique_handles, unique_labels, loc='upper right', bbox_to_anchor=(0.98, 0.93), 
              fontsize=11, framealpha=1.0, facecolor='white', edgecolor='black')
    
    plt.tight_layout()
    plt.subplots_adjust(top=0.92)
    plt.savefig(f'{output_dir}/comprehensive_stress_test_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated: {output_dir}/comprehensive_stress_test_analysis.png")

def main():
    parser = argparse.ArgumentParser(description='Generate stress test analysis graphs')
    parser.add_argument('--output-dir', '-o', default='figures-stress-test', 
                       help='Output directory for generated figures')
    parser.add_argument('--timeseries', action='store_true',
                       help='Generate time-series graphs (requires timeseries CSV files)')
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print("Loading stress test data...")
    
    # Load summary data (always available)
    data = load_stress_test_data()
    
    if not data:
        print("No stress test summary data found. Please run stress tests and save CSV files first.")
        print("Expected files: *_stress_test_summary_*.csv")
        return
    
    print(f"Found summary data for frameworks: {list(data.keys())}")
    
    # Generate standard visualizations from summary data
    print("\nGenerating summary visualizations...")
    generate_fps_stress_graph(data, output_dir)
    generate_memory_stress_graph(data, output_dir)
    generate_latency_heatmap(data, output_dir)
    
    # Generate summary table
    print("\nGenerating summary table...")
    summary_df = generate_summary_table(data, output_dir)
    
    files_generated = [
        "fps_under_stress.png",
        "memory_stress_bar.png",
        "latency_heatmap.png",
        "stress_test_summary.csv"
    ]
    
    # Load and process time-series data if requested and available
    if args.timeseries:
        print("\nLoading time-series data...")
        timeseries_data = load_timeseries_data()
        
        if timeseries_data:
            print(f"Found time-series data for frameworks: {list(timeseries_data.keys())}")
            
            print("\nGenerating time-series visualizations...")
            generate_timeseries_fps_graph(timeseries_data, output_dir)
            generate_timeseries_frequency_accuracy_graph(timeseries_data, output_dir)
            generate_timeseries_memory_graph(timeseries_data, output_dir)
            generate_timeseries_latency_graph(timeseries_data, output_dir)
            generate_comprehensive_stress_test_graph(timeseries_data, output_dir)
            
            files_generated.extend([
                "stress_test_timeseries_fps.png",
                "stress_test_timeseries_frequency_accuracy.png",
                "stress_test_timeseries_memory.png",
                "stress_test_timeseries_latency.png",
                "comprehensive_stress_test_analysis.png"
            ])
        else:
            print("No time-series data found. Expected files: *_stress_test_timeseries_*.csv")
            print("Run with standard summary graphs only.")
    
    print(f"\nAll figures saved to: {output_dir}")
    print("Files generated:")
    for file in files_generated:
        print(f"- {file}")
    
    if not args.timeseries:
        print("\nTip: Use --timeseries flag to generate detailed time-series graphs")
        print("     (requires time-series CSV files from enhanced stress tests)")

if __name__ == '__main__':
    main()
