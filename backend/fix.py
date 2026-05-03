import sys

file_path = r'e:\GED237\backend\app\api\v1\endpoints\documents.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '    document = await _get_document_or_404(db, current_user.tenant_id, document_id)\n    if not await _can_mutate_document(current_user, document):'

replacement = '''        }
        for version, user in versions
    ]


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the binary content of the document.
    """
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_read_document(current_user, document):
        raise HTTPException(
            status_code=403, detail="Not enough privileges to access this document"
        )
    
    if not document.file_path:
        raise HTTPException(status_code=404, detail="Document file not found")
        
    full_path = storage_service.get_full_path(document.file_path)
    
    # Simple check for S3 URI
    if full_path.startswith("s3://"):
        content = storage_service.get_file_content(document.file_path)
        if not content:
            raise HTTPException(status_code=404, detail="File content not found in S3")
        from fastapi import Response
        return Response(content=content, media_type=document.mime_type)
    
    import os
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    from fastapi.responses import FileResponse
    filename = document.title
    # If title doesn't have an extension but the file_path has one, append it
    ext = os.path.splitext(document.file_path)[1]
    if ext and not filename.lower().endswith(ext.lower()):
        filename += ext
        
    return FileResponse(
        path=full_path, 
        media_type=document.mime_type, 
        filename=filename,
        content_disposition_type="inline"
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_mutate_document(current_user, document):'''

if target in content:
    new_content = content.replace(target, replacement, 1)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('SUCCESS')
else:
    print('TARGET NOT FOUND')
