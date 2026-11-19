// frontend/components/document/DocumentPreviewTab.tsx
import React from 'react';
import { DocumentPreview } from '../preview';
import {
  DocumentPreviewTabView,
  type DocumentPreviewTabProps,
} from '../../lib/documentPreviewTab';

export const DocumentPreviewTab: React.FC<DocumentPreviewTabProps> = (props) => (
  <DocumentPreviewTabView {...props} PreviewRenderer={DocumentPreview} />
);
