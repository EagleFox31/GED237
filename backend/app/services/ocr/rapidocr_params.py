"""RapidOCR model selection, shared by the image build (download) and the runtime.

Standalone on purpose (no application import): the Dockerfile copies this single
file before the application code to download the models in their own cached layer.
"""


def rapidocr_params(model_dir: str) -> dict:
    from rapidocr import LangRec, ModelType, OCRVersion

    return {
        "Global.model_root_dir": model_dir,
        "Global.use_cls": False,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
        "Rec.lang_type": LangRec.LATIN,
        "Rec.model_type": ModelType.MOBILE,
    }
