"""
Unit tests for file validation and storage utilities.
"""

import os
import tempfile
import uuid
from unittest.mock import Mock, patch, MagicMock
from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile, InMemoryUploadedFile
from django.core.files.storage import default_storage
from io import BytesIO

from .file_utils import FileValidator, FileStorageManager


class FileValidatorTests(TestCase):
    """Test cases for FileValidator class."""
    
    def setUp(self):
        self.validator = FileValidator()
    
    def test_validate_file_success_csv(self):
        """Test successful validation of a CSV file."""
        csv_content = b"name,age,city\nJohn,25,NYC\nJane,30,LA"
        uploaded_file = SimpleUploadedFile(
            "test.csv", 
            csv_content, 
            content_type="text/csv"
        )
        
        result = self.validator.validate_file(uploaded_file)
        self.assertTrue(result)
        self.assertEqual(len(self.validator.errors), 0)
    
    def test_validate_file_success_tsv(self):
        """Test successful validation of a TSV file."""
        tsv_content = b"name\tage\tcity\nJohn\t25\tNYC\nJane\t30\tLA"
        uploaded_file = SimpleUploadedFile(
            "test.tsv", 
            tsv_content, 
            content_type="text/tab-separated-values"
        )
        
        result = self.validator.validate_file(uploaded_file)
        self.assertTrue(result)
        self.assertEqual(len(self.validator.errors), 0)
    
    def test_validate_file_no_file_provided(self):
        """Test validation fails when no file is provided."""
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(None)
        
        self.assertIn("No file provided", str(context.exception))
    
    def test_validate_file_size_too_large(self):
        """Test validation fails for files exceeding size limit."""
        # Create a mock file that reports a large size
        large_file = Mock()
        large_file.name = "large_file.csv"
        large_file.size = FileValidator.MAX_FILE_SIZE + 1
        large_file.read.return_value = b"name,age\nJohn,25"
        large_file.seek = Mock()
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(large_file)
        
        error_message = str(context.exception)
        self.assertIn("exceeds maximum limit", error_message)
        self.assertIn("100", error_message)  # Should mention 100MB limit
    
    def test_validate_file_empty_file(self):
        """Test validation fails for empty files."""
        empty_file = SimpleUploadedFile("empty.csv", b"", content_type="text/csv")
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(empty_file)
        
        self.assertIn("File is empty", str(context.exception))
    
    def test_validate_file_invalid_extension(self):
        """Test validation fails for files with invalid extensions."""
        txt_file = SimpleUploadedFile(
            "test.txt", 
            b"some content", 
            content_type="text/plain"
        )
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(txt_file)
        
        error_message = str(context.exception)
        self.assertIn("not allowed", error_message)
        self.assertIn(".txt", error_message)
        self.assertIn(".csv", error_message)
        self.assertIn(".tsv", error_message)
    
    def test_validate_file_no_extension(self):
        """Test validation fails for files without extensions."""
        no_ext_file = SimpleUploadedFile(
            "noextension", 
            b"name,age\nJohn,25", 
            content_type="text/plain"
        )
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(no_ext_file)
        
        self.assertIn("not allowed", str(context.exception))
    
    def test_validate_file_content_empty_after_read(self):
        """Test validation fails for files that appear empty when read."""
        # File with only whitespace
        whitespace_file = SimpleUploadedFile(
            "whitespace.csv", 
            b"   \n\n   \t\t   ", 
            content_type="text/csv"
        )
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(whitespace_file)
        
        self.assertIn("empty or contains no readable content", str(context.exception))
    
    def test_validate_file_content_no_delimiters(self):
        """Test validation fails for files without CSV/TSV delimiters."""
        no_delim_file = SimpleUploadedFile(
            "no_delimiters.csv", 
            b"just some text without any delimiters here", 
            content_type="text/csv"
        )
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(no_delim_file)
        
        self.assertIn("does not appear to be a valid CSV or TSV", str(context.exception))
    
    def test_validate_file_content_unicode_decode_error(self):
        """Test validation handles files with invalid unicode characters."""
        # Create file with invalid UTF-8 bytes that will cause decode errors
        invalid_unicode = b"\xff\xfe\x00\x00"
        binary_file = SimpleUploadedFile(
            "binary.csv", 
            invalid_unicode, 
            content_type="text/csv"
        )
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(binary_file)
        
        # The error message might be about invalid characters or no delimiters
        error_message = str(context.exception)
        self.assertTrue(
            "invalid characters" in error_message or 
            "no delimiters found" in error_message or
            "empty or contains no readable content" in error_message
        )
    
    def test_validate_filename_security_path_traversal(self):
        """Test validation fails for filenames with path traversal attempts."""
        dangerous_names = [
            "..\\..\\windows\\system32\\config.csv",  # Only test backslashes as Django handles forward slashes
        ]
        
        for dangerous_name in dangerous_names:
            with self.subTest(filename=dangerous_name):
                dangerous_file = SimpleUploadedFile(
                    dangerous_name, 
                    b"name,age\nJohn,25", 
                    content_type="text/csv"
                )
                
                with self.assertRaises(ValidationError) as context:
                    self.validator.validate_file(dangerous_file)
                
                self.assertIn("invalid path characters", str(context.exception))
    
    def test_validate_filename_security_null_bytes(self):
        """Test validation fails for filenames with null bytes."""
        null_byte_file = SimpleUploadedFile(
            "test\x00.csv", 
            b"name,age\nJohn,25", 
            content_type="text/csv"
        )
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(null_byte_file)
        
        self.assertIn("null bytes", str(context.exception))
    
    def test_validate_filename_security_too_long(self):
        """Test validation fails for filenames that are too long."""
        # Create a filename that's exactly 256 characters (over the 255 limit)
        long_filename = "a" * 252 + ".csv"  # 256 characters total
        
        # Use a mock to bypass Django's own filename validation
        mock_file = Mock()
        mock_file.name = long_filename
        mock_file.size = 100
        mock_file.read.return_value = b"name,age\nJohn,25"
        mock_file.seek = Mock()
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(mock_file)
        
        self.assertIn("too long", str(context.exception))
    
    def test_validate_filename_security_empty_filename(self):
        """Test validation fails for empty filenames."""
        # Use a mock to test empty filename since Django's SimpleUploadedFile doesn't allow empty names
        mock_file = Mock()
        mock_file.name = ""
        mock_file.size = 100
        mock_file.read.return_value = b"name,age\nJohn,25"
        mock_file.seek = Mock()
        
        with self.assertRaises(ValidationError) as context:
            self.validator.validate_file(mock_file)
        
        self.assertIn("empty", str(context.exception))
    
    def test_sanitize_filename_basic(self):
        """Test basic filename sanitization."""
        result = FileValidator.sanitize_filename("my_file.csv")
        self.assertEqual(result, "my_file.csv")
    
    def test_sanitize_filename_dangerous_characters(self):
        """Test sanitization removes dangerous characters."""
        dangerous_filename = "my<>file|with*dangerous?chars.csv"
        result = FileValidator.sanitize_filename(dangerous_filename)
        self.assertEqual(result, "myfilewithdangerouschars.csv")
    
    def test_sanitize_filename_path_components(self):
        """Test sanitization removes path components."""
        path_filename = "/path/to/my/file.csv"
        result = FileValidator.sanitize_filename(path_filename)
        self.assertEqual(result, "file.csv")
    
    def test_sanitize_filename_multiple_spaces(self):
        """Test sanitization normalizes multiple spaces."""
        spaced_filename = "my    file   with   spaces.csv"
        result = FileValidator.sanitize_filename(spaced_filename)
        self.assertEqual(result, "my file with spaces.csv")
    
    def test_sanitize_filename_leading_trailing_dots(self):
        """Test sanitization removes leading/trailing dots and spaces."""
        dotted_filename = "  ...my_file.csv...  "
        result = FileValidator.sanitize_filename(dotted_filename)
        self.assertEqual(result, "my_file.csv")
    
    def test_sanitize_filename_empty_after_sanitization(self):
        """Test sanitization handles filenames that become empty."""
        empty_after = "<<<>>>|||***"
        result = FileValidator.sanitize_filename(empty_after)
        self.assertEqual(result, "unnamed_file")
    
    def test_sanitize_filename_too_long(self):
        """Test sanitization truncates long filenames."""
        long_name = "a" * 250 + ".csv"
        result = FileValidator.sanitize_filename(long_name)
        self.assertTrue(len(result) <= 200)
        self.assertTrue(result.endswith(".csv"))
    
    def test_sanitize_filename_none_input(self):
        """Test sanitization handles None input."""
        result = FileValidator.sanitize_filename(None)
        self.assertEqual(result, "unnamed_file")
    
    def test_sanitize_filename_empty_string(self):
        """Test sanitization handles empty string input."""
        result = FileValidator.sanitize_filename("")
        self.assertEqual(result, "unnamed_file")


class FileStorageManagerTests(TestCase):
    """Test cases for FileStorageManager class."""
    
    def setUp(self):
        self.storage_manager = FileStorageManager()
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        # Clean up any test files
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    @patch('dataset.file_utils.default_storage')
    def test_save_uploaded_file_success(self, mock_storage):
        """Test successful file saving."""
        # Setup mock
        mock_storage.save.return_value = "datasets/2024/01/abc12345_test.csv"
        
        # Create test file
        test_content = b"name,age\nJohn,25"
        uploaded_file = SimpleUploadedFile("test.csv", test_content)
        
        # Test the method
        with patch.object(self.storage_manager, '_generate_unique_filename') as mock_unique:
            mock_unique.return_value = "abc12345_test.csv"
            with patch.object(self.storage_manager, '_get_directory_path') as mock_dir:
                mock_dir.return_value = "datasets/2024/01"
                
                saved_path, sanitized_name = self.storage_manager.save_uploaded_file(
                    uploaded_file, "test.csv"
                )
        
        # Verify results
        self.assertEqual(saved_path, "datasets/2024/01/abc12345_test.csv")
        self.assertEqual(sanitized_name, "test.csv")
        mock_storage.save.assert_called_once()
    
    @patch('dataset.file_utils.default_storage')
    def test_save_uploaded_file_with_sanitization(self, mock_storage):
        """Test file saving with filename sanitization."""
        mock_storage.save.return_value = "datasets/2024/01/abc12345_dangerous_file.csv"
        
        test_content = b"name,age\nJohn,25"
        uploaded_file = SimpleUploadedFile("dangerous<>file.csv", test_content)
        
        with patch.object(self.storage_manager, '_generate_unique_filename') as mock_unique:
            mock_unique.return_value = "abc12345_dangerousfile.csv"
            with patch.object(self.storage_manager, '_get_directory_path') as mock_dir:
                mock_dir.return_value = "datasets/2024/01"
                
                saved_path, sanitized_name = self.storage_manager.save_uploaded_file(
                    uploaded_file
                )
        
        # Verify sanitization occurred
        self.assertEqual(sanitized_name, "dangerousfile.csv")
    
    @patch('dataset.file_utils.default_storage')
    def test_delete_file_success(self, mock_storage):
        """Test successful file deletion."""
        mock_storage.exists.return_value = True
        mock_storage.delete.return_value = None
        
        result = self.storage_manager.delete_file("datasets/2024/01/test.csv")
        
        self.assertTrue(result)
        mock_storage.exists.assert_called_once_with("datasets/2024/01/test.csv")
        mock_storage.delete.assert_called_once_with("datasets/2024/01/test.csv")
    
    @patch('dataset.file_utils.default_storage')
    def test_delete_file_not_exists(self, mock_storage):
        """Test deletion of non-existent file."""
        mock_storage.exists.return_value = False
        
        result = self.storage_manager.delete_file("datasets/2024/01/nonexistent.csv")
        
        self.assertTrue(result)  # Should return True even if file doesn't exist
        mock_storage.exists.assert_called_once_with("datasets/2024/01/nonexistent.csv")
        mock_storage.delete.assert_not_called()
    
    @patch('dataset.file_utils.default_storage')
    def test_delete_file_empty_path(self, mock_storage):
        """Test deletion with empty file path."""
        result = self.storage_manager.delete_file("")
        self.assertTrue(result)
        
        result = self.storage_manager.delete_file(None)
        self.assertTrue(result)
        
        mock_storage.exists.assert_not_called()
        mock_storage.delete.assert_not_called()
    
    @patch('dataset.file_utils.default_storage')
    @patch('builtins.print')  # Mock print to avoid output during tests
    def test_delete_file_exception(self, mock_print, mock_storage):
        """Test file deletion handles exceptions gracefully."""
        mock_storage.exists.return_value = True
        mock_storage.delete.side_effect = Exception("Storage error")
        
        result = self.storage_manager.delete_file("datasets/2024/01/test.csv")
        
        self.assertFalse(result)
        mock_print.assert_called_once()
        self.assertIn("Error deleting file", mock_print.call_args[0][0])
    
    @patch('dataset.file_utils.default_storage')
    def test_file_exists(self, mock_storage):
        """Test file existence check."""
        mock_storage.exists.return_value = True
        
        result = self.storage_manager.file_exists("datasets/2024/01/test.csv")
        
        self.assertTrue(result)
        mock_storage.exists.assert_called_once_with("datasets/2024/01/test.csv")
    
    @patch('dataset.file_utils.default_storage')
    def test_get_file_size(self, mock_storage):
        """Test getting file size."""
        mock_storage.size.return_value = 1024
        
        result = self.storage_manager.get_file_size("datasets/2024/01/test.csv")
        
        self.assertEqual(result, 1024)
        mock_storage.size.assert_called_once_with("datasets/2024/01/test.csv")
    
    @patch('dataset.file_utils.default_storage')
    def test_get_file_size_exception(self, mock_storage):
        """Test getting file size handles exceptions."""
        mock_storage.size.side_effect = Exception("File not found")
        
        result = self.storage_manager.get_file_size("datasets/2024/01/nonexistent.csv")
        
        self.assertIsNone(result)
    
    @patch('dataset.file_utils.default_storage')
    def test_get_file_path(self, mock_storage):
        """Test getting full file path."""
        mock_storage.path.return_value = "/full/path/to/datasets/2024/01/test.csv"
        
        result = self.storage_manager.get_file_path("datasets/2024/01/test.csv")
        
        self.assertEqual(result, "/full/path/to/datasets/2024/01/test.csv")
        mock_storage.path.assert_called_once_with("datasets/2024/01/test.csv")
    
    def test_generate_unique_filename(self):
        """Test unique filename generation."""
        original = "my_file.csv"
        
        with patch('uuid.uuid4') as mock_uuid:
            mock_uuid.return_value = Mock()
            mock_uuid.return_value.__str__ = Mock(return_value="12345678-1234-1234-1234-123456789012")
            
            result = self.storage_manager._generate_unique_filename(original)
        
        self.assertEqual(result, "12345678_my_file.csv")
    
    @patch('dataset.file_utils.datetime')
    def test_get_directory_path(self, mock_datetime):
        """Test directory path generation."""
        # Mock datetime to return a specific date
        mock_now = Mock()
        mock_now.year = 2024
        mock_now.month = 3
        mock_datetime.now.return_value = mock_now
        
        result = self.storage_manager._get_directory_path()
        
        expected = os.path.join("datasets", "2024", "03")
        self.assertEqual(result, expected)
    
    @patch('dataset.file_utils.default_storage')
    def test_cleanup_orphaned_files_success(self, mock_storage):
        """Test successful orphaned file cleanup."""
        # Mock file structure
        mock_storage.exists.return_value = True
        
        # Mock the recursive file listing
        with patch.object(self.storage_manager, '_get_all_files_recursive') as mock_get_files:
            mock_get_files.return_value = [
                "datasets/2024/01/file1.csv",
                "datasets/2024/01/file2.csv",
                "datasets/2024/01/file3.csv"
            ]
            
            # Mock delete_file method
            with patch.object(self.storage_manager, 'delete_file') as mock_delete:
                mock_delete.return_value = True
                
                existing_files = ["datasets/2024/01/file1.csv"]  # Only file1 should be kept
                deleted_count, error_count = self.storage_manager.cleanup_orphaned_files(existing_files)
        
        # Should delete file2 and file3 (2 files)
        self.assertEqual(deleted_count, 2)
        self.assertEqual(error_count, 0)
        self.assertEqual(mock_delete.call_count, 2)
    
    @patch('dataset.file_utils.default_storage')
    def test_cleanup_orphaned_files_with_errors(self, mock_storage):
        """Test orphaned file cleanup with some deletion errors."""
        mock_storage.exists.return_value = True
        
        with patch.object(self.storage_manager, '_get_all_files_recursive') as mock_get_files:
            mock_get_files.return_value = [
                "datasets/2024/01/file1.csv",
                "datasets/2024/01/file2.csv"
            ]
            
            with patch.object(self.storage_manager, 'delete_file') as mock_delete:
                # First deletion succeeds, second fails
                mock_delete.side_effect = [True, False]
                
                existing_files = []  # No files should be kept
                deleted_count, error_count = self.storage_manager.cleanup_orphaned_files(existing_files)
        
        self.assertEqual(deleted_count, 1)
        self.assertEqual(error_count, 1)
    
    @patch('dataset.file_utils.default_storage')
    @patch('builtins.print')
    def test_cleanup_orphaned_files_exception(self, mock_print, mock_storage):
        """Test orphaned file cleanup handles exceptions."""
        mock_storage.exists.side_effect = Exception("Storage error")
        
        existing_files = []
        deleted_count, error_count = self.storage_manager.cleanup_orphaned_files(existing_files)
        
        self.assertEqual(deleted_count, 0)
        self.assertEqual(error_count, 1)
        mock_print.assert_called_once()
        self.assertIn("Error during orphaned file cleanup", mock_print.call_args[0][0])
    
    @patch('dataset.file_utils.default_storage')
    def test_get_all_files_recursive(self, mock_storage):
        """Test recursive file listing."""
        # Mock directory structure
        def mock_listdir(path):
            if path == "datasets":
                return (["2024"], [])  # One subdirectory, no files
            elif path == "datasets/2024":
                return (["01", "02"], ["root_file.csv"])  # Two subdirs, one file
            elif path == "datasets/2024/01":
                return ([], ["file1.csv", "file2.csv"])  # No subdirs, two files
            elif path == "datasets/2024/02":
                return ([], ["file3.csv"])  # No subdirs, one file
            else:
                return ([], [])
        
        mock_storage.listdir.side_effect = mock_listdir
        
        result = self.storage_manager._get_all_files_recursive("datasets")
        
        expected_files = [
            "datasets/2024/root_file.csv",
            "datasets/2024/01/file1.csv",
            "datasets/2024/01/file2.csv",
            "datasets/2024/02/file3.csv"
        ]
        
        self.assertEqual(sorted(result), sorted(expected_files))
    
    @patch('dataset.file_utils.default_storage')
    @patch('builtins.print')
    def test_get_all_files_recursive_exception(self, mock_print, mock_storage):
        """Test recursive file listing handles exceptions."""
        mock_storage.listdir.side_effect = Exception("Permission denied")
        
        result = self.storage_manager._get_all_files_recursive("datasets")
        
        self.assertEqual(result, [])
        mock_print.assert_called_once()
        self.assertIn("Error listing directory", mock_print.call_args[0][0])


class FileUtilsIntegrationTests(TestCase):
    """Integration tests for file utilities working together."""
    
    def setUp(self):
        self.validator = FileValidator()
        self.storage_manager = FileStorageManager()
    
    def test_validate_and_store_workflow(self):
        """Test the complete workflow of validating and storing a file."""
        # Create a valid CSV file
        csv_content = b"name,age,city\nJohn,25,NYC\nJane,30,LA"
        uploaded_file = SimpleUploadedFile("test_data.csv", csv_content)
        
        # Validate the file
        is_valid = self.validator.validate_file(uploaded_file)
        self.assertTrue(is_valid)
        
        # Reset file pointer after validation
        uploaded_file.seek(0)
        
        # Mock storage operations for the test
        with patch('dataset.file_utils.default_storage') as mock_storage:
            mock_storage.save.return_value = "datasets/2024/01/abc12345_test_data.csv"
            
            # Store the file
            saved_path, sanitized_name = self.storage_manager.save_uploaded_file(uploaded_file)
            
            self.assertIsNotNone(saved_path)
            self.assertEqual(sanitized_name, "test_data.csv")
    
    def test_validate_fails_then_no_storage(self):
        """Test that invalid files are not stored."""
        # Create an invalid file (wrong extension)
        invalid_file = SimpleUploadedFile("test.txt", b"some content")
        
        # Validation should fail
        with self.assertRaises(ValidationError):
            self.validator.validate_file(invalid_file)
        
        # File should not be stored after validation failure
        # (This is more of a workflow test - in real usage, 
        # validation would happen before storage)