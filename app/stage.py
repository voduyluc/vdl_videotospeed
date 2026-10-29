import sys

if __name__ == '__main__':
    step, pid = sys.argv[1:]
    if step == 'translate':
        from app.translate import translate
        translate(pid)
    elif step == 'condense':
        from app.translate import condense
        condense(pid)
    else:
        from app.media import extract, export, mix
        {'extract': extract, 'export': export, 'mix': mix}[step](pid)
