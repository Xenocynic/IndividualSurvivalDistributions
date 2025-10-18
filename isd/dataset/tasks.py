"""
Dataset processing tasks for feature imputation and other data operations.
"""
import pandas as pd
import numpy as np
import os
import logging
from django.core.files.storage import default_storage
from django.conf import settings
from .models import Dataset
from .file_utils import FileStorageManager

logger = logging.getLogger(__name__)


def process_feature_imputation(dataset_id):
    """
    Process feature imputation for a dataset.
    Replaces missing values with column means for numeric columns.
    
    Args:
        dataset_id (int): The ID of the dataset to process
        
    Returns:
        dict: Result dictionary with success status and details
    """
    try:
        # Get the dataset
        dataset = Dataset.objects.get(dataset_id=dataset_id)
        
        if not dataset.file_path:
            return {
                'success': False,
                'error': 'No file associated with this dataset'
            }
        
        # Read the dataset file
        storage_manager = FileStorageManager()
        file_path = storage_manager.get_full_path(dataset.file_path)
        
        logger.info(f"Starting feature imputation for dataset {dataset_id}: {dataset.dataset_name}")
        
        # Determine file type and read accordingly
        if dataset.file_path.lower().endswith('.csv'):
            df = pd.read_csv(file_path)
        elif dataset.file_path.lower().endswith('.tsv'):
            df = pd.read_csv(file_path, sep='\t')
        else:
            # Try CSV as default
            df = pd.read_csv(file_path)
        
        # Store original info
        original_shape = df.shape
        original_missing = df.isnull().sum().sum()
        
        if original_missing == 0:
            return {
                'success': True,
                'details': {
                    'message': 'No missing values found in dataset',
                    'rows': original_shape[0],
                    'columns': original_shape[1],
                    'missing_values_before': 0,
                    'missing_values_after': 0
                }
            }
        
        # Perform imputation
        imputed_columns = []
        
        # Process numeric columns
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        for col in numeric_columns:
            missing_count = df[col].isnull().sum()
            if missing_count > 0:
                mean_value = df[col].mean()
                df[col] = df[col].fillna(mean_value)
                imputed_columns.append({
                    'column': col,
                    'type': 'numeric',
                    'missing_count': int(missing_count),
                    'imputed_with': 'mean',
                    'imputed_value': float(mean_value) if not pd.isna(mean_value) else None
                })
        
        # Process categorical columns (mode imputation)
        categorical_columns = df.select_dtypes(include=['object', 'category']).columns
        for col in categorical_columns:
            missing_count = df[col].isnull().sum()
            if missing_count > 0:
                mode_value = df[col].mode()
                if len(mode_value) > 0:
                    df[col] = df[col].fillna(mode_value[0])
                    imputed_columns.append({
                        'column': col,
                        'type': 'categorical',
                        'missing_count': int(missing_count),
                        'imputed_with': 'mode',
                        'imputed_value': str(mode_value[0])
                    })
                else:
                    # If no mode available, fill with 'Unknown'
                    df[col] = df[col].fillna('Unknown')
                    imputed_columns.append({
                        'column': col,
                        'type': 'categorical',
                        'missing_count': int(missing_count),
                        'imputed_with': 'default',
                        'imputed_value': 'Unknown'
                    })
        
        # Save the imputed dataset
        # Create a backup of the original file first
        backup_path = dataset.file_path.replace('.csv', '_backup.csv').replace('.tsv', '_backup.tsv')
        storage_manager.copy_file(dataset.file_path, backup_path)
        
        # Save the imputed data
        if dataset.file_path.lower().endswith('.tsv'):
            df.to_csv(file_path, sep='\t', index=False)
        else:
            df.to_csv(file_path, index=False)
        
        # Update file size
        new_file_size = storage_manager.get_file_size(dataset.file_path)
        dataset.file_size = new_file_size
        dataset.save()
        
        final_missing = df.isnull().sum().sum()
        
        logger.info(f"Feature imputation completed for dataset {dataset_id}. "
                   f"Missing values: {original_missing} -> {final_missing}")
        
        return {
            'success': True,
            'details': {
                'message': 'Feature imputation completed successfully',
                'rows': original_shape[0],
                'columns': original_shape[1],
                'missing_values_before': int(original_missing),
                'missing_values_after': int(final_missing),
                'imputed_columns': imputed_columns,
                'backup_created': backup_path
            }
        }
        
    except Dataset.DoesNotExist:
        logger.error(f"Dataset {dataset_id} not found")
        return {
            'success': False,
            'error': f'Dataset {dataset_id} not found'
        }
    except pd.errors.EmptyDataError:
        logger.error(f"Dataset {dataset_id} file is empty")
        return {
            'success': False,
            'error': 'Dataset file is empty or corrupted'
        }
    except pd.errors.ParserError as e:
        logger.error(f"Error parsing dataset {dataset_id}: {str(e)}")
        return {
            'success': False,
            'error': f'Error parsing dataset file: {str(e)}'
        }
    except Exception as e:
        logger.error(f"Error processing feature imputation for dataset {dataset_id}: {str(e)}")
        return {
            'success': False,
            'error': f'Feature imputation failed: {str(e)}'
        }


def validate_dataset_for_imputation(dataset_id):
    """
    Validate if a dataset is suitable for feature imputation.
    
    Args:
        dataset_id (int): The ID of the dataset to validate
        
    Returns:
        dict: Validation result with details about missing values
    """
    try:
        dataset = Dataset.objects.get(dataset_id=dataset_id)
        
        if not dataset.file_path:
            return {
                'valid': False,
                'error': 'No file associated with this dataset'
            }
        
        # Read the dataset file
        storage_manager = FileStorageManager()
        file_path = storage_manager.get_full_path(dataset.file_path)
        
        # Determine file type and read accordingly
        if dataset.file_path.lower().endswith('.csv'):
            df = pd.read_csv(file_path)
        elif dataset.file_path.lower().endswith('.tsv'):
            df = pd.read_csv(file_path, sep='\t')
        else:
            df = pd.read_csv(file_path)
        
        # Analyze missing values
        total_cells = df.shape[0] * df.shape[1]
        missing_cells = df.isnull().sum().sum()
        missing_percentage = (missing_cells / total_cells) * 100 if total_cells > 0 else 0
        
        # Column-wise missing value analysis
        missing_by_column = []
        for col in df.columns:
            missing_count = df[col].isnull().sum()
            if missing_count > 0:
                missing_by_column.append({
                    'column': col,
                    'missing_count': int(missing_count),
                    'missing_percentage': (missing_count / len(df)) * 100,
                    'data_type': str(df[col].dtype)
                })
        
        return {
            'valid': True,
            'details': {
                'total_rows': df.shape[0],
                'total_columns': df.shape[1],
                'total_missing_values': int(missing_cells),
                'missing_percentage': round(missing_percentage, 2),
                'columns_with_missing': missing_by_column,
                'has_missing_values': missing_cells > 0
            }
        }
        
    except Exception as e:
        logger.error(f"Error validating dataset {dataset_id} for imputation: {str(e)}")
        return {
            'valid': False,
            'error': f'Validation failed: {str(e)}'
        }