import {
  Button,
  Checkbox,
  Loading,
  templateToString,
  useConfirmModal,
  useDisposable,
} from '@affine/component';
import { Pagination } from '@affine/component/member-components';
import { BlobManagementService } from '@affine/core/modules/blob-management/services';
import { useI18n } from '@affine/i18n';
import type { ListedBlobRecord } from '@affine/nbstore';
import { getAttachmentFileIcon } from '@blocksuite/affine/blocks';
import { DeleteIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import bytes from 'bytes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as styles from './style.css';

const Empty = () => {
  const t = useI18n();
  return (
    <div className={styles.empty}>
      {t['com.affine.settings.workspace.storage.unused-blobs.empty']()}
    </div>
  );
};

const useBlob = (blobRecord: ListedBlobRecord) => {
  const unusedBlobsEntity = useService(BlobManagementService).unusedBlobs;
  return useDisposable(
    (abortSignal?: AbortSignal) =>
      unusedBlobsEntity.hydrateBlob(blobRecord, abortSignal),
    [blobRecord]
  );
};

const BlobPreview = ({ blobRecord }: { blobRecord: ListedBlobRecord }) => {
  const { data, loading, error } = useBlob(blobRecord);

  const element = useMemo(() => {
    if (loading) return <Loading size={24} />;
    if (!data?.url || !data.type) return null;

    const { url, type, mime } = data;

    const icon = templateToString(getAttachmentFileIcon(type));

    if (error) {
      return (
        <div
          className={styles.unknownBlobIcon}
          dangerouslySetInnerHTML={{ __html: icon }}
        />
      );
    }

    if (mime?.startsWith('image/')) {
      return (
        <img
          className={styles.blobImagePreview}
          src={url}
          alt={blobRecord.key}
        />
      );
    } else {
      return (
        <div
          className={styles.unknownBlobIcon}
          dangerouslySetInnerHTML={{ __html: icon }}
        />
      );
    }
  }, [loading, data, error, blobRecord.key]);

  return (
    <div className={styles.blobPreviewContainer}>
      <div className={styles.blobPreview}>{element}</div>
      <div className={styles.blobPreviewFooter}>
        <div className={styles.blobPreviewName}>{blobRecord.key}</div>
        <div className={styles.blobPreviewInfo}>
          {data?.type} · {bytes(blobRecord.size)}
        </div>
      </div>
    </div>
  );
};

const BlobCard = ({
  blobRecord,
  onClick,
  selected,
}: {
  blobRecord: ListedBlobRecord;
  onClick: () => void;
  selected: boolean;
}) => {
  return (
    <div
      data-testid="blob-preview-card"
      className={styles.blobCard}
      data-selected={selected}
      onClick={onClick}
    >
      <Checkbox className={styles.blobGridItemCheckbox} checked={selected} />
      <BlobPreview blobRecord={blobRecord} />
    </div>
  );
};

const PAGE_SIZE = 9;

export const BlobManagementPanel = () => {
  const t = useI18n();

  const unusedBlobsEntity = useService(BlobManagementService).unusedBlobs;
  const originalUnusedBlobs = useLiveData(unusedBlobsEntity.unusedBlobs$);
  const isLoading = useLiveData(unusedBlobsEntity.isLoading$);
  const [pageNum, setPageNum] = useState(0);
  const [skip, setSkip] = useState(0);

  const [unusedBlobs, setUnusedBlobs] = useState<ListedBlobRecord[]>([]);
  const unusedBlobsPage = useMemo(() => {
    return unusedBlobs.slice(skip, skip + PAGE_SIZE);
  }, [unusedBlobs, skip]);

  useEffect(() => {
    setUnusedBlobs(originalUnusedBlobs);
  }, [originalUnusedBlobs]);

  useEffect(() => {
    unusedBlobsEntity.revalidate();
  }, [unusedBlobsEntity]);

  const [selectedBlobs, setSelectedBlobs] = useState<ListedBlobRecord[]>([]);
  const [deleting, setDeleting] = useState(false);

  const handleSelectBlob = useCallback((blob: ListedBlobRecord) => {
    setSelectedBlobs(prev => {
      if (prev.includes(blob)) {
        return prev;
      }
      return [...prev, blob];
    });
  }, []);

  const handleUnselectBlob = useCallback((blob: ListedBlobRecord) => {
    setSelectedBlobs(prev => prev.filter(b => b.key !== blob.key));
  }, []);

  const handleSelectAll = useCallback(() => {
    unusedBlobsPage.forEach(blob => handleSelectBlob(blob));
  }, [unusedBlobsPage, handleSelectBlob]);

  const { openConfirmModal } = useConfirmModal();

  const handleDeleteSelectedBlobs = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const currentSelectedBlobs = selectedBlobs;
      openConfirmModal({
        title:
          t[
            'com.affine.settings.workspace.storage.unused-blobs.delete.title'
          ](),
        children:
          t[
            'com.affine.settings.workspace.storage.unused-blobs.delete.warning'
          ](),
        onConfirm: async () => {
          setDeleting(true);
          for (const blob of currentSelectedBlobs) {
            await unusedBlobsEntity.deleteBlob(blob.key, true);
            handleUnselectBlob(blob);
            setUnusedBlobs(prev => prev.filter(b => b.key !== blob.key));
          }
          setDeleting(false);
        },
        confirmText: t['Delete'](),
        cancelText: t['Cancel'](),
        confirmButtonOptions: {
          variant: 'error',
        },
      });
    },
    [selectedBlobs, openConfirmModal, t, unusedBlobsEntity, handleUnselectBlob]
  );

  const blobPreviewGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blobPreviewGridRef.current) {
      const unselectBlobs = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (
          !blobPreviewGridRef.current?.contains(target) &&
          !target.closest('modal-transition-container')
        ) {
          setSelectedBlobs([]);
        }
      };
      document.addEventListener('click', unselectBlobs);
      return () => {
        document.removeEventListener('click', unselectBlobs);
      };
    }
    return;
  }, [unusedBlobs]);

  return (
    <>
      {selectedBlobs.length > 0 ? (
        <div className={styles.blobManagementControls}>
          <div className={styles.blobManagementName}>
            {`${selectedBlobs.length} ${t['com.affine.settings.workspace.storage.unused-blobs.selected']()}`}
          </div>
          <div className={styles.spacer} />
          <Button onClick={handleSelectAll} variant="primary">
            {t['com.affine.keyboardShortcuts.selectAll']()}
          </Button>
          <Button
            loading={deleting}
            onClick={handleDeleteSelectedBlobs}
            prefix={<DeleteIcon />}
            disabled={deleting}
          >
            {t['Delete']()}
          </Button>
        </div>
      ) : (
        <div className={styles.blobManagementNameInactive}>
          {`${t['com.affine.settings.workspace.storage.unused-blobs']()} (${unusedBlobs.length})`}
        </div>
      )}
      <div className={styles.blobManagementContainer}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <Loading size={32} />
          </div>
        ) : unusedBlobs.length === 0 ? (
          <Empty />
        ) : (
          <>
            <div className={styles.blobPreviewGrid} ref={blobPreviewGridRef}>
              {unusedBlobs.slice(skip, skip + PAGE_SIZE).map(blob => {
                const selected = selectedBlobs.includes(blob);
                return (
                  <BlobCard
                    key={blob.key}
                    blobRecord={blob}
                    onClick={() =>
                      selected
                        ? handleUnselectBlob(blob)
                        : handleSelectBlob(blob)
                    }
                    selected={selected}
                  />
                );
              })}
            </div>
            <Pagination
              pageNum={pageNum}
              totalCount={unusedBlobs.length}
              countPerPage={PAGE_SIZE}
              onPageChange={(_, pageNum) => {
                setPageNum(pageNum);
                setSkip(pageNum * PAGE_SIZE);
              }}
            />
          </>
        )}
      </div>
    </>
  );
};
