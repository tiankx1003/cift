import logging
import sys

_logger = logging.getLogger("cift-python")


def setup_logger() -> logging.Logger:
    _logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    _logger.addHandler(handler)
    return _logger


logger = setup_logger()
