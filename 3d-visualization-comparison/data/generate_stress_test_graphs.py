#!/usr/bin/env python3
"""
Stress Test Analysis and Visualization
Generates graphs and tables for thesis stress testing section
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from pathlib import Path
import glob
import argparse

def load_stress_test_data():
    """Load stress test CSV files for all frameworks"""
    data = {}
    
    # Look for stress test CSV files
    csv_files = glob.glob("*_stress_test_*.csv")
    
    for csv_file in csv_files:
        # Extract framework name from filename
        framework = csv_file.split('_stress_test_')[0]
        
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
                    print(f"Loaded {framework} data: {len(df)} frequency points")
                else:
                    print(f"Warning: No valid data found in {csv_file}")
            else:
                print(f"Warning: Could not find CSV header in {csv_file}")
                
        except Exception as e:
            print(f"Error loading {csv_file}: {e}")
    
    return data

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

def main():
    parser = argparse.ArgumentParser(description='Generate stress test analysis graphs')
    parser.add_argument('--output-dir', '-o', default='figures', 
                       help='Output directory for generated figures')
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print("Loading stress test data...")
    data = load_stress_test_data()
    
    if not data:
        print("No stress test data found. Please run stress tests and save CSV files first.")
        print("Expected files: *_stress_test_*.csv")
        return
    
    print(f"Found data for frameworks: {list(data.keys())}")
    
    # Generate visualizations
    print("\nGenerating visualizations...")
    generate_fps_stress_graph(data, output_dir)
    generate_memory_stress_graph(data, output_dir)
    generate_latency_heatmap(data, output_dir)
    
    # Generate summary table
    print("\nGenerating summary table...")
    summary_df = generate_summary_table(data, output_dir)
    
    print(f"\nAll figures saved to: {output_dir}")
    print("Files generated:")
    print("- fps_under_stress.png")
    print("- memory_stress_bar.png") 
    print("- latency_heatmap.png")
    print("- stress_test_summary.csv")

if __name__ == '__main__':
    main()
