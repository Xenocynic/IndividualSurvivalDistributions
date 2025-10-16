"""
Management command to verify edit functionality by checking if changes persist.
"""

from django.core.management.base import BaseCommand
from dataset.models import Dataset


class Command(BaseCommand):
    help = 'Verify that dataset edit functionality works by checking database changes'

    def handle(self, *args, **options):
        self.stdout.write("Verifying edit functionality...")
        
        # Look for the test dataset
        try:
            dataset = Dataset.objects.get(dataset_name__icontains="Patient Survival")
            self.stdout.write(f"Found test dataset:")
            self.stdout.write(f"  ID: {dataset.dataset_id}")
            self.stdout.write(f"  Name: {dataset.dataset_name}")
            self.stdout.write(f"  Notes: {dataset.notes}")
            self.stdout.write(f"  Time Unit: {dataset.time_unit}")
            self.stdout.write(f"  Public: {dataset.is_public}")
            self.stdout.write(f"  Last Modified: {dataset.uploaded_at}")
            
            self.stdout.write("\nIf you made changes via the frontend, they should be reflected above.")
            self.stdout.write("Try editing the dataset and run this command again to verify changes persist.")
            
        except Dataset.DoesNotExist:
            self.stdout.write(self.style.WARNING("Test dataset not found. Run 'create_edit_test_dataset' first."))
        except Dataset.MultipleObjectsReturned:
            datasets = Dataset.objects.filter(dataset_name__icontains="Patient Survival")
            self.stdout.write(f"Found {datasets.count()} datasets with 'Patient Survival' in the name:")
            for dataset in datasets:
                self.stdout.write(f"  ID {dataset.dataset_id}: {dataset.dataset_name}")
        
        self.stdout.write("\nEdit functionality verification completed.")