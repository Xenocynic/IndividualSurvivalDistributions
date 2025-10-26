from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import Dataset
from folders.models import Folder, FolderItem
from django.contrib.contenttypes.models import ContentType


class DatasetFolderIntegrationTestCase(APITestCase):
    """Test folder integration with dataset API."""
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        # Create a test folder
        self.folder = Folder.objects.create(
            name='Test Folder',
            owner=self.user,
            is_private=False
        )
        
        # Create a test CSV file
        self.test_file = SimpleUploadedFile(
            "test_dataset.csv",
            b"id,age,status\n1,25,alive\n2,30,dead\n",
            content_type="text/csv"
        )
    
    def test_create_dataset_with_folder_assignment(self):
        """Test creating a dataset and assigning it to a folder."""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'dataset_name': 'Test Dataset',
            'notes': 'Test notes',
            'time_unit': 'month',
            'is_public': False,
            'folder_id': self.folder.folder_id,
            'file': self.test_file
        }
        
        response = self.client.post('/api/datasets/', data, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that dataset was created
        dataset = Dataset.objects.get(dataset_name='Test Dataset')
        self.assertEqual(dataset.owner, self.user)
        
        # Check that dataset was added to folder
        dataset_ct = ContentType.objects.get_for_model(Dataset)
        folder_item = FolderItem.objects.filter(
            folder=self.folder,
            content_type=dataset_ct,
            object_id=dataset.dataset_id
        ).first()
        
        self.assertIsNotNone(folder_item)
        self.assertEqual(folder_item.added_by, self.user)
    
    def test_create_dataset_with_invalid_folder(self):
        """Test creating a dataset with invalid folder_id."""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'dataset_name': 'Test Dataset',
            'notes': 'Test notes',
            'time_unit': 'month',
            'is_public': False,
            'folder_id': 99999,  # Non-existent folder
            'file': self.test_file
        }
        
        response = self.client.post('/api/datasets/', data, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('details', response.data)
        self.assertIn('folder_id', response.data['details'])
    
    def test_create_dataset_with_other_users_folder(self):
        """Test creating a dataset with another user's folder."""
        other_folder = Folder.objects.create(
            name='Other Folder',
            owner=self.other_user,
            is_private=False
        )
        
        self.client.force_authenticate(user=self.user)
        
        data = {
            'dataset_name': 'Test Dataset',
            'notes': 'Test notes',
            'time_unit': 'month',
            'is_public': False,
            'folder_id': other_folder.folder_id,
            'file': self.test_file
        }
        
        response = self.client.post('/api/datasets/', data, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('details', response.data)
        self.assertIn('folder_id', response.data['details'])
    
    def test_list_datasets_with_folder_filtering(self):
        """Test listing datasets with folder filtering."""
        self.client.force_authenticate(user=self.user)
        
        # Create datasets - one in folder, one not
        dataset1 = Dataset.objects.create(
            dataset_name='Dataset 1',
            owner=self.user,
            time_unit='month'
        )
        
        dataset2 = Dataset.objects.create(
            dataset_name='Dataset 2',
            owner=self.user,
            time_unit='month'
        )
        
        # Add dataset1 to folder
        dataset_ct = ContentType.objects.get_for_model(Dataset)
        FolderItem.objects.create(
            folder=self.folder,
            content_type=dataset_ct,
            object_id=dataset1.dataset_id,
            added_by=self.user
        )
        
        # Test filtering by folder
        response = self.client.get(f'/api/datasets/?folder_id={self.folder.folder_id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['dataset_id'], dataset1.dataset_id)
        
        # Test filtering for items not in any folder
        response = self.client.get('/api/datasets/?folder_id=null')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['dataset_id'], dataset2.dataset_id)
    
    def test_dataset_serializer_includes_folder_info(self):
        """Test that dataset serializer includes folder information."""
        self.client.force_authenticate(user=self.user)
        
        # Create dataset
        dataset = Dataset.objects.create(
            dataset_name='Test Dataset',
            owner=self.user,
            time_unit='month'
        )
        
        # Add to folder
        dataset_ct = ContentType.objects.get_for_model(Dataset)
        FolderItem.objects.create(
            folder=self.folder,
            content_type=dataset_ct,
            object_id=dataset.dataset_id,
            added_by=self.user
        )
        
        # Retrieve dataset
        response = self.client.get(f'/api/datasets/{dataset.dataset_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check folder information is included
        self.assertIn('folder', response.data)
        self.assertIsNotNone(response.data['folder'])
        self.assertEqual(response.data['folder']['folder_id'], self.folder.folder_id)
        self.assertEqual(response.data['folder']['name'], self.folder.name)