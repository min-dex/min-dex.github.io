"""Bounded default gate: new, existing unique and invalid legacy prayer slots."""
import os
from pathlib import Path
import runpy

os.environ['MINDEX_AUDIT_TYPE'] = 'holy-week-dawn'
runpy.run_path(str(Path(__file__).with_name('smoke_inline_template_save_audit.py')), run_name='__main__')
