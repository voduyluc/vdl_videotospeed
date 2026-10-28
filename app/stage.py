import sys

if __name__ == '__main__':
    step, pid = sys.argv[1:]
    if step == 'translate':
        from app.translate import translate
        translate(pid)
    else:
        from app.media import extract, export
        {'extract': extract, 'export': export}[step](pid)
